# NAIM Studio v5

NovelAI 이미지 생성을 위한 모바일 우선 클라이언트입니다. 최신 본체는
`NAIM_Studio_v5_pair_rotate (9).html`이며, 웹/PWA와 Android 앱 모두 이 파일을
사용합니다. 기존 IndexedDB/localStorage 스키마는 변경하지 않았습니다.

## 웹/PWA

정적 웹 서버로 저장소 루트를 배포한 뒤 `index.html`에 접속합니다. 서비스 워커는
최신 pair-rotate 본체와 EXIF 파서를 캐시하므로 설치 후 UI를 오프라인에서도 열 수
있습니다. 이미지 생성과 외부 글꼴/라이브러리의 최초 로드는 네트워크가 필요합니다.

## Android APK 빌드

요구 사항은 JDK 17과 Android SDK 35입니다. Android Studio에서 저장소 루트를
열어 `app` 구성을 빌드하거나 다음 명령을 실행합니다.

```bash
./gradlew assembleDebug
```

debug APK는 `app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다. 빌드 시
Gradle의 `syncWebAssets` 작업이 최신 HTML을 안전한 asset 이름인 `index.html`로
자동 복사하므로 원본 파일명을 바꾸거나 수동 복사하지 않아도 됩니다. APK 파일은
Git에 포함하지 않습니다.

GitHub Actions의 **Android debug APK** 워크플로를 수동 실행하거나 PR/관련 파일
변경 시 실행하면 `naim-studio-debug-apk` artifact를 받을 수 있습니다.

## Android 동작

- WebView에서 JavaScript, IndexedDB/localStorage, 이미지/파일 선택, 다운로드,
  공유, 클립보드와 외부 링크를 지원합니다.
- 회전은 Activity/WebView 상태를 유지하고 Android 뒤로가기는 열린 UI 또는
  WebView 기록을 우선 처리합니다.
- 생성 대기열이 실제로 실행되는 동안에만 foreground service와 partial WakeLock을
  사용합니다. Android 13 이상에서는 최초 생성 시 알림 권한을 요청하며 지속 알림을
  표시합니다.
- 선택한 8개 다크 테마는 `naim_color_theme` 키에 저장되고 Android 상태/탐색
  표시줄 색에도 반영됩니다.

foreground service는 WebView 프로세스가 백그라운드에서 중단될 가능성을 줄이지만,
사용자의 강제 종료, Android의 강제 프로세스 종료, 제조사별 절전 정책까지 우회하지는
못합니다. 앱 작업 목록을 제거하면 서비스와 WakeLock도 종료됩니다.

브라우저 PWA와 Android WebView는 서로 다른 저장소 origin을 사용하므로 브라우저의
기존 데이터를 APK가 자동으로 읽을 수는 없습니다. 필요한 경우 웹의 **데이터 관리**
내보내기/가져오기로 옮길 수 있으며, 가져온 데이터의 스키마와 이후 앱 업데이트의
저장 데이터는 그대로 유지됩니다.

## 테스트

EXIF/NovelAI 메타데이터의 다중 슬롯, 긴 프롬프트, 중첩 positive/negative 구조는
Node 내장 테스트로 검증합니다.

```bash
node --test tests/exif-metadata.test.js
```
