@echo off
cd ../esos-assemble
echo Building JS Preprocessor...
node -e "require('child_process').execSync('pegjs asm.pegjs')"
cd ../bbjos/
echo Building .bbj files...
if exist target (
) else (
mkdir target
)
if exist disk (
) else (
mkdir disk
)
cd src
node ../../esos-assemble/index.js main.bbj ../target/main
echo Building emulator & splitting into disk...
cd ../..
cargo run -- INTODISK=./bbjos/disk ./bbjos/target/main
cd ./bbjos
echo Finished.
