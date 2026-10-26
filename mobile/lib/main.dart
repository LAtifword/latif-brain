import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/state/backend_config.dart';
import 'core/storage/app_prefs.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/app_shell.dart';
import 'features/connect/presentation/connect_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await AppPrefs.create();
  runApp(AgentOSApp(prefs: prefs));
}

class AgentOSApp extends StatelessWidget {
  const AgentOSApp({super.key, required this.prefs});

  final AppPrefs prefs;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AppPrefs>.value(value: prefs),
        ChangeNotifierProvider<BackendConfig>(create: (_) => BackendConfig(prefs)),
      ],
      child: MaterialApp(
        title: 'AgentOS',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        home: _RootRouter(prefs: prefs),
      ),
    );
  }
}

class _RootRouter extends StatefulWidget {
  const _RootRouter({required this.prefs});

  final AppPrefs prefs;

  @override
  State<_RootRouter> createState() => _RootRouterState();
}

class _RootRouterState extends State<_RootRouter> {
  late bool _onboarded = widget.prefs.onboarded && widget.prefs.backendUrl != null;

  @override
  Widget build(BuildContext context) {
    if (!_onboarded) {
      return ConnectScreen(onConnected: () => setState(() => _onboarded = true));
    }
    return const AppShell();
  }
}
