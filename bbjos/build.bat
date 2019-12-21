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
cd src
node ../../esos-assemble/index.js main.bbj ../target/main.bbj
echo Success. Building emulator...
cd ../..
cargo build
cd ./bbjos
echo Built successfully.
