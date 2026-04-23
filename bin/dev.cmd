@echo off

node --import tsx/esm --no-warnings=ExperimentalWarning "%~dp0\dev" %*
