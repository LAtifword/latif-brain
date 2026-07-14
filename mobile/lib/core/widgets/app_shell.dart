import 'package:flutter/material.dart';

import '../../features/agents/presentation/agents_screen.dart';
import '../../features/chat/presentation/chat_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../theme/app_theme.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _titles = ['AgentOS', 'Chat Agent', 'Agents', 'Settings'];

  void _openAgentsTab() => setState(() => _index = 2);

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(onOpenAgent: (_) => _openAgentsTab()),
      const ChatScreen(),
      const AgentsScreen(),
      const SettingsScreen(),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(_titles[_index])),
      body: SafeArea(child: pages[_index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: AppColors.surface,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline_rounded), selectedIcon: Icon(Icons.chat_bubble_rounded), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.hub_outlined), selectedIcon: Icon(Icons.hub_rounded), label: 'Agents'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings_rounded), label: 'Settings'),
        ],
      ),
    );
  }
}
