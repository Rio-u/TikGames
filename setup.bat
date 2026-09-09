@echo off
chcp 65001 >nul
title TikGames - تثبيت وتشغيل

rem  دبل كليك على الملف ده وخلاص. بيثبّت كل حاجة ناقصة (Node، pnpm، MongoDB)، بيجهّز
rem  قاعدة البيانات والحسابات، وبيشغّل المشروع كله.
rem
rem  الشغل الحقيقي في scripts\setup.ps1 — الملف ده بس بيرفع الصلاحيات ويشغّله، لأن تثبيت
rem  MongoDB محتاج صلاحيات أدمن.

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   محتاجين صلاحيات أدمن عشان نثبّت MongoDB — هيطلع لك طلب موافقة، اضغط "نعم".
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo   التثبيت وقف عند خطأ. اقرا الرسالة اللي فوق.
) else (
  echo   خلصنا. تقدر تقفل الشباك ده — الخدمات شغالة في الخلفية.
)
echo.
pause
