#![feature(untagged_unions)]

use minifb::{WindowOptions, Window};

use std::path::Path;
use page::*;
pub mod page;

pub const WIDTH:  usize = 640;
pub const HEIGHT: usize = 360;

fn main() {
	let mut args = std::env::args();
	let disk = args.nth(1).expect("Expected disk directory.");
	if disk.starts_with("INTODISK=") {
		let file = args.next().expect("If given `INTODISK=`, a raw file is expected.");
		let folder: &Path = disk[9..].as_ref();
		let data = std::fs::read(file).unwrap();
		for i in 0..(data.len() / PAGE_SIZE) {
			std::fs::write(
				folder.join(i.to_string()),
				&data[i * PAGE_SIZE..][..PAGE_SIZE]
			).unwrap();
		}
		return;
	}
	assert_eq!(std::mem::size_of::<minifb::Key>(), 1);
	let mut memory = PageManager::new(disk.into(), 5);

	let mut window = Window::new(
		"ESOS",
		WIDTH,
		HEIGHT,
		WindowOptions::default()
	).unwrap();

	let mut ip = unsafe {
		memory.first_page().layout.entry as usize
	};
	while window.is_open() {
		unsafe {
			{
				let first_page = memory.first_page_mut();
				std::ptr::write_bytes(first_page.layout.keys.as_mut_ptr(), 255, 16);
				if let Some(keys) = window.get_keys() {
					std::ptr::copy_nonoverlapping(
						keys.as_ptr() as *const u8,
						first_page.layout.keys.as_mut_ptr(),
						keys.len()
					);
				}
			}
			let a = memory.code(ip);
			let b = memory.code(ip + 1);
			let c = memory.code(ip + 2);
			let v = memory.data(a as usize);
			*memory.data_mut(b as usize) = v;
			ip = c as usize;
			let first_page = memory.try_page_mut(0).unwrap();
			window.update_with_buffer_size(&first_page.layout.vbuf, WIDTH, HEIGHT).unwrap();
			if ip as u32 == std::u32::MAX {
				break;
			}
		}
	}
}
