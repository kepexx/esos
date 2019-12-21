use memmap::MmapMut;
use lru::LruCache;

use crate::{WIDTH, HEIGHT};

use std::path::PathBuf;
use std::fs::OpenOptions;
use std::pin::Pin;

pub const VBUF_SIZE: usize = WIDTH * HEIGHT;
pub const PAGE_SIZE: usize = 1024 * 1024 * 4; // 4MiB

#[repr(C)]
pub struct FirstPageLayout {
	pub entry: u32,
	pub handler: MemErrorHandler,
	pub io: MemIO
}

#[repr(C)]
pub struct MemErrorHandler {
	pub addr: u32,
	pub oldip: u32,
	pub attempted_access: u32
}

#[repr(C)]
pub struct MemIO {
	pub keys: [u8; 16],
	pub vbuf: [u32; VBUF_SIZE]
}

pub union Page {
	pub layout: FirstPageLayout,
	pub code: [u32; PAGE_SIZE / 4],
	pub data: [u8; PAGE_SIZE]
}

impl Page {
	#[inline]
	pub fn from_mmap<'a>(m: &'a MmapMut) -> &'a Page {
		debug_assert_eq!(m.len(), PAGE_SIZE);
		unsafe {
			&*(m.as_ptr() as *const Page)
		}
	}

	#[inline]
	pub fn from_mmap_mut<'a>(m: &'a mut MmapMut) -> &'a mut Page {
		debug_assert_eq!(m.len(), PAGE_SIZE);
		unsafe {
			&mut *(m.as_mut_ptr() as *mut Page)
		}
	}
}

pub struct PageManager {
	pub diskfolder: PathBuf,
	pub pages: LruCache<usize, Pin<Box<MmapMut>>>,
	pub forceloaded_first_page: MmapMut
}

impl PageManager {
	pub fn new(diskfolder: PathBuf, cap: usize) -> PageManager {
		PageManager {
			diskfolder: diskfolder.clone(),
			pages: LruCache::new(cap),
			forceloaded_first_page: Self::load_page(diskfolder, 0)
		}
	}

	#[inline]
	pub fn load_page(mut diskfolder: PathBuf, page: usize) -> MmapMut {
		diskfolder.push(page.to_string());
		let file = OpenOptions::new()
			.read(true)
			.write(true)
			.create(true)
			.open(diskfolder)
			.unwrap();
		file.set_len(PAGE_SIZE as u64).unwrap();
		unsafe {
			MmapMut::map_mut(&file).unwrap()
		}
	}

	#[inline]
	pub fn first_page<'a>(&'a self) -> &'a Page {
		Page::from_mmap(&self.forceloaded_first_page)
	}

	#[inline]
	pub fn first_page_mut<'a>(&'a mut self) -> &'a mut Page {
		Page::from_mmap_mut(&mut self.forceloaded_first_page)
	}

	#[inline]
	pub fn try_page_or<'a, Q, Y, N>(&'a mut self, idx: usize, y: Y, n: N) -> Q
		where Y: FnOnce(&'a Page) -> Q,
		      N: FnOnce(&'a mut Self) -> Q
	{
		if idx == 0 {
			y(self.first_page())
		} else {
			let this = self as *mut Self;
			if let Some(x) = self.pages.get(&idx).map(|x| Page::from_mmap(x)) {
				y(x)
			} else {
				n(unsafe {&mut *this})
			}
		}
	}

	#[inline]
	pub fn try_page_mut_or<'a, Q, Y, N>(&'a mut self, idx: usize, y: Y, n: N) -> Q
		where Y: FnOnce(&'a mut Page) -> Q,
		      N: FnOnce(&'a mut Self) -> Q
	{
		if idx == 0 {
			y(self.first_page_mut())
		} else {
			let this = self as *mut Self;
			if let Some(x) = self.pages.get_mut(&idx).map(|x| Page::from_mmap_mut(x)) {
				y(x)
			} else {
				n(unsafe {&mut *this})
			}
		}
	}

	#[inline]
	pub fn try_page<'a>(&'a mut self, idx: usize) -> Option<&'a Page> {
		self.try_page_or::<'a>(idx, Some, |_| None)
	}

	#[inline]
	pub fn try_page_mut<'a>(&'a mut self, idx: usize) -> Option<&'a mut Page> {
		self.try_page_mut_or::<'a>(idx, Some, |_| None)
	}

	#[inline]
	pub fn page<'a>(&'a mut self, idx: usize) -> &'a Page {
		self.try_page_or(idx, |x| x, |this| {
			let v = Box::pin(
				Self::load_page(this.diskfolder.clone(), idx)
			);
			let p = &*v as *const MmapMut;
			this.pages.put(idx, v);
			Page::from_mmap(unsafe {&*p})
		})
	}

	#[inline]
	pub fn page_mut<'a>(&'a mut self, idx: usize) -> &'a mut Page {
		self.try_page_mut_or(idx, |x| x, |this| {
			let mut v = Box::pin(
				Self::load_page(this.diskfolder.clone(), idx)
			);
			let p = &mut *v as *mut MmapMut;
			this.pages.put(idx, v);
			Page::from_mmap_mut(unsafe {&mut *p})
		})
	}

	#[inline]
	pub fn data(&mut self, idx: usize) -> u8 {
		let (page, in_page) = split_index(idx);
		self.try_page(page).map(|p| unsafe {
			p.data[in_page]
		}).unwrap_or(0)
	}

	#[inline]
	pub fn data_mut<'a>(&'a mut self, idx: usize) -> &'a mut u8 {
		let (page, in_page) = split_index(idx);
		unsafe {
			&mut self.page_mut(page).data[in_page]
		}
	}

	#[inline]
	pub fn code(&mut self, idx: usize) -> u32 {
		let (page, in_page) = split_index_code(idx);
		self.try_page(page).map(|p| unsafe {
			p.code[in_page]
		}).unwrap_or(0)
	}

	#[inline]
	pub fn code_mut<'a>(&'a mut self, idx: usize) -> &'a mut u32 {
		let (page, in_page) = split_index_code(idx);
		unsafe {
			&mut self.page_mut(page).code[in_page]
		}
	}
}

pub fn split_index(idx: usize) -> (usize, usize) {
	// Meaning of these numbers:
	// 2^22     == PAGE_SIZE
	// 0x3FFFFF == PAGE_SIZE - 1
	//
	// Essentially, this is equivalent to
	//   (idx / PAGE_SIZE, idx % PAGE_SIZE)
	// but written efficiently just incase the optimizer
	// doesn't fix it.
	(idx >> 22, idx & 0x3FFFFF)
}

pub fn split_index_code(idx: usize) -> (usize, usize) {
	// Meaning of these numbers:
	// 2^20 == PAGE_SIZE / 4
	// 0xFFFFF == PAGE_SIZE / 4 - 1
	(idx >> 20, idx & 0xFFFFF)
}
