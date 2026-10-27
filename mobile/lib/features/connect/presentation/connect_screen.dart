import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_client.dart';
import '../../../core/state/backend_config.dart';
import '../../../core/storage/app_prefs.dart';
import '../../../core/theme/app_theme.dart';

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key, required this.onConnected});

  final VoidCallback onConnected;

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _controller = TextEditingController(text: 'http://127.0.0.1:8765');
  bool _connecting = false;
  String? _error;

  Future<void> _connect() async {
    setState(() {
      _connecting = true;
      _error = null;
    });
    final config = context.read<BackendConfig>();
    await config.setBaseUrl(_controller.text);
    final client = ApiClient(config);
    try {
      await client.get('/api/system/health');
      config.setConnectionState(BackendConnectionState.connected);
      await context.read<AppPrefs>().setOnboarded(true);
      if (!mounted) return;
      widget.onConnected();
    } on ApiException catch (e) {
      config.setConnectionState(BackendConnectionState.unreachable, error: e.message);
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _connecting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.hub_rounded, color: AppColors.primary, size: 56),
              const SizedBox(height: 16),
              const Text(
                'AgentOS',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textPrimary, fontSize: 28, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              const Text(
                'Connect to your local AgentOS backend to get started. '
                'Nothing here talks to the cloud — every agent runs on hardware you control.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _controller,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Backend URL',
                  hintText: 'http://127.0.0.1:8765',
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _connecting ? null : _connect,
                child: _connecting
                    ? const SizedBox(
                        width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                    : const Text('Connect'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
