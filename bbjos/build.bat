@echo off
cd ../esos-assemble
echo Building JS Preprocessor...
node -e "require('child_process').execSync('pegjs asm.pegjs')"
cd ../bbjos/
echo Building .bbj files...
if exist target (
rem
) else (
mkdir target
)
if exist disk (
rem
) else (
mkdir disk
)
cd src
node ../../esos-assemble/index.js main.bbj ../target/main %*
echo Building emulator and splitting into disk...
cd ../..
cargo run -- INTODISK=./bbjos/disk ./bbjos/target/main
cd ./bbjos
echo Finished.
