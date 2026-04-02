@echo off
setlocal

if not exist test-artifacts\screenshots mkdir test-artifacts\screenshots
if not exist test-artifacts\reports mkdir test-artifacts\reports
if not exist test-artifacts\traces mkdir test-artifacts\traces

if "%1"=="logic" (
  pytest tests_logic
  goto :eof
)

if "%1"=="e2e" (
  pytest tests_e2e
  goto :eof
)

pytest
