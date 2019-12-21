cd ../esos-assemble
echo Building JS Preprocessor...
node -e "require('child_process').execSync('pegjs asm.pegjs')"
cd ../bbjos/
echo Building .bbj files...
mkdir target
mkdir disk
cd src
node ../../esos-assemble/index.js main.bbj ../target/main.bbj
echo Building emulator & splitting into disk...
cd ../..
cargo run -- INTODISK=./bbjos/disk ./bbjos/target/main
cd ./bbjos
echo Finished.
