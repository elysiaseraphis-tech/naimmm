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

1.0.1에서는 시작 시 CSS가 로드되기 전에 빈 테마 색상이 Android로 전달되는
경로를 차단했습니다. Android 쪽에서도 null·빈 색상값을 무시합니다.
기존 설치와 서명 키가 같으면 업데이트할 수 있지만, CI debug APK는 실행마다
서명 키가 달라질 수 있습니다. 설치가 충돌하더라도 데이터 백업 없이 기존 앱을
삭제하지 마세요. 빌드 성공과 실제 기기의 실행 확인은 별개입니다.

## Android 동작

- 1.0.3에서는 업로드된 `5pAk0.png`를 Android 적응형 런처 아이콘으로 적용했습니다.
  원본은 `app/src/main/res/drawable-nodpi/launcher_artwork.png`에 보관하며,
  원형·둥근 사각형 등 런처 모양에 맞춰 표시됩니다.
- 1.0.2에서는 일반 모드에서 상태바·내비게이션바·디스플레이 컷아웃을 피하도록
  WebView 영역을 조정합니다. 앱의 **FULL** 토글은 Android 시스템 바를 숨기는
  몰입 모드로 연결되며, 뒤로가기로 해제할 수 있습니다. 키보드와 컷아웃 영역은
  전체화면에서도 피합니다. 시스템 바는 가장자리 스와이프로 잠시 표시할 수 있습니다.
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

Android 앱 설정의 **Android 백그라운드 설정** 버튼은 시스템 앱 정보 화면을 엽니다.
갤럭시에서는 **배터리 → 제한 없음**을 선택하고 생성 알림을 허용하세요.
이는 별도의 무제한 백그라운드 실행 권한이 아니며, OS의 서비스 시간 제한이나
네트워크 단절을 없애지는 않습니다. 실제 생성 대기열은 여전히 WebView JavaScript에서
실행됩니다. WakeLock은 최대 6시간이며 Android 15 이상의 `dataSync` foreground
service에는 별도의 백그라운드 시간 제한도 적용됩니다. 시스템의 timeout 콜백에서는
서비스를 종료하여 시간 초과에 따른 앱 오류를 피합니다.

생성 중 홈이나 다른 앱으로 전환할 수 있으며, 뒤로가기로 화면을 나갈 때도 작업 중이면
Activity를 종료하지 않고 백그라운드로 보냅니다. 생성 알림을 누르면 기존 Activity로
돌아옵니다. 최근 앱에서 제거하거나 강제 종료하지 마세요. 예상치 못한 대기열 오류가
발생해도 서비스 종료 신호를 보내 WakeLock이 불필요하게 유지되지 않도록 합니다.
프로세스가 종료되면 저장된 대기열은 다음 실행 때 일시정지 상태로 복원되며 사용자가
재개해야 합니다. 처리 중이던 요청의 서버 완료 여부까지 복구하는 것은 아니므로
재개 전에 생성 결과를 확인하세요. 100장 연속 생성이나 특정 One UI 버전에서의
무중단 실행을 보장하지 않으며 실제 기기 검증이 필요합니다.

브라우저 PWA와 Android WebView는 서로 다른 저장소 origin을 사용하므로 브라우저의
기존 데이터를 APK가 자동으로 읽을 수는 없습니다. 필요한 경우 웹의 **데이터 관리**
내보내기/가져오기로 옮길 수 있으며, 가져온 데이터의 스키마와 이후 앱 업데이트의
저장 데이터는 그대로 유지됩니다.

## 테스트

EXIF/NovelAI 메타데이터의 다중 슬롯, 긴 프롬프트, 중첩 positive/negative 구조,
CSS 로드 전후의 시작 테마 전달, Android/웹 전체화면 분기와 생성 서비스 종료 신호는
Node 내장 테스트로 검증합니다.

```bash
node --test tests/*.test.js
```
