cd ../esos-assemble
echo Building JS Preprocessor...
pegjs asm.pegjs
cd ../bbjos/src
echo Building .bbj files...
node ../../esos-assemble/index.js main.bbj ../target/main.bbj
echo Success. Building emulator...
cd ../..
cargo build
cd ./bbjos
echo Built successfully.
