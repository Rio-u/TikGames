@echo off
chcp 65001 >nul
title TikGames - تثبيت وتشغيل

rem  دبل كليك على الملف ده وخلاص. بيثبّت كل حاجة ناقصة (Node و pnpm)، بيجهّز
rem  الحسابات والخلفيات على Supabase، وبيشغّل المشروع كله.
rem
rem  قاعدة البيانات بقت Supabase (Postgres) على السحابة — مفيش داتا بيز بتتثبت محلياً؛
rem  محتاج بس DATABASE_URL يكون متظبط في apps\api\.env و packages\database\.env.
rem
rem  الشغل الحقيقي في scripts\setup.ps1 — الملف ده بس بيرفع الصلاحيات ويشغّله، عشان تثبيت
rem  Node محتاج صلاحيات أدمن.

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   محتاجين صلاحيات أدمن عشان نثبّت المتطلبات — هيطلع لك طلب موافقة، اضغط "نعم".
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
