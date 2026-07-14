# AgentOS mobile app

Flutter client for the AgentOS backend (`../backend`). See the root
[ARCHITECTURE.md](../ARCHITECTURE.md) for the full design.

## Run

```bash
flutter pub get
flutter run
```

On first launch you'll be asked for the backend's URL. The backend must
already be running (see `../backend/README.md`).

- Android emulator → host machine: `http://10.2.0.2:8765` on Genymotion or
  `http://10.0.2.2:8765` on the standard Android emulator.
- Physical device → run the backend on a machine reachable on the same
  Wi-Fi network and use its LAN IP.

## Structure

Feature-first under `lib/features/{dashboard,chat,agents,settings,connect}`,
each split into `data/` (API clients), `models/`, and `presentation/`.
Shared theme, network, storage, and DI-adjacent (Provider) code lives in
`lib/core/`.

## Not yet verified

This app was written without access to a Flutter/Dart toolchain (sandboxed
build environment — see root README's "Verification status"). Run
`flutter pub get && flutter analyze` before trusting it compiles, and
`flutter test` if you add widget tests.

## Toolchain note

`android/` carries the Gradle/AGP/Kotlin versions (Gradle 7.6.3, AGP 7.3.0,
Kotlin 1.7.10) from the app this scaffold started from. They work, but are
a bit dated — if `flutter run` prompts you to upgrade, follow its
`flutter build` guidance rather than editing versions by hand.
