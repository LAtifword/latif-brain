import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../../core/network/api_client.dart';
import '../../../core/state/backend_config.dart';
import '../../../core/theme/app_theme.dart';
import '../data/chat_api.dart';
import '../data/chat_socket.dart';
import '../models/chat_message.dart';
import '../models/conversation.dart';
import 'widgets/message_bubble.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late final ChatApi _api;
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();

  Conversation? _conversation;
  final List<ChatMessage> _messages = [];
  ChatSocket? _socket;
  StreamSubscription<ChatStreamEvent>? _socketSub;
  ChatMessage? _streamingMessage;

  bool _initializing = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final config = context.read<BackendConfig>();
    _api = ChatApi(ApiClient(config), config);
    _init();
  }

  Future<void> _init() async {
    try {
      final conversations = await _api.listConversations();
      final conversation =
          conversations.isNotEmpty ? conversations.first : await _api.createConversation('New chat');
      final history = conversations.isNotEmpty ? await _api.listMessages(conversation.id) : <ChatMessage>[];
      if (!mounted) return;
      setState(() {
        _conversation = conversation;
        _messages
          ..clear()
          ..addAll(history.where((m) => m.role != ChatRole.system));
        _initializing = false;
      });
      _connectSocket();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _initializing = false;
      });
    }
  }

  void _connectSocket() {
    if (_conversation == null) return;
    _socket = _api.openSocket(_conversation!.id);
    _socketSub = _socket!.events.listen(_onEvent, onError: (e) {
      if (!mounted) return;
      setState(() => _sending = false);
    });
  }

  void _onEvent(ChatStreamEvent event) {
    if (!mounted) return;
    switch (event) {
      case ChatToken token:
        setState(() {
          _streamingMessage?.content += token.content;
        });
        _scrollToBottom();
      case ChatDone _:
        setState(() {
          _streamingMessage?.isStreaming = false;
          _streamingMessage = null;
          _sending = false;
        });
      case ChatError err:
        setState(() {
          if (_streamingMessage != null) {
            _messages.remove(_streamingMessage);
            _streamingMessage = null;
          }
          _sending = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err.detail), backgroundColor: AppColors.danger),
        );
    }
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent + 80,
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOut,
    );
  }

  void _send() {
    final text = _inputController.text.trim();
    if (text.isEmpty || _sending || _socket == null) return;

    final userMessage = ChatMessage(
      id: const Uuid().v4(),
      role: ChatRole.user,
      content: text,
      createdAt: DateTime.now(),
    );
    final assistantMessage = ChatMessage(
      id: const Uuid().v4(),
      role: ChatRole.assistant,
      content: '',
      createdAt: DateTime.now(),
      isStreaming: true,
    );

    setState(() {
      _messages.add(userMessage);
      _messages.add(assistantMessage);
      _streamingMessage = assistantMessage;
      _sending = true;
      _inputController.clear();
    });
    _socket!.send(text);
    _scrollToBottom();
  }

  @override
  void dispose() {
    _socketSub?.cancel();
    _socket?.close();
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_initializing) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary), textAlign: TextAlign.center),
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? const Center(
                  child: Text('Ask the Chat Agent anything. Runs entirely on your local model.',
                      style: TextStyle(color: AppColors.textSecondary), textAlign: TextAlign.center),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length,
                  itemBuilder: (context, i) => MessageBubble(message: _messages[i]),
                ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _inputController,
                    minLines: 1,
                    maxLines: 5,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: const InputDecoration(
                      hintText: 'Message the Chat Agent…',
                      hintStyle: TextStyle(color: AppColors.textSecondary),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _sending ? null : _send,
                  icon: const Icon(Icons.arrow_upward_rounded),
                  style: IconButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
