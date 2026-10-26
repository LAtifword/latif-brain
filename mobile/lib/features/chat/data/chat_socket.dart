import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

sealed class ChatStreamEvent {}

class ChatToken extends ChatStreamEvent {
  ChatToken(this.content);
  final String content;
}

class ChatDone extends ChatStreamEvent {}

class ChatError extends ChatStreamEvent {
  ChatError(this.detail);
  final String detail;
}

/// One WebSocket connection to /api/chat/ws/{conversationId}. Real
/// token-by-token streaming from the backend's Chat Agent — no client-side
/// simulation of typing.
class ChatSocket {
  ChatSocket(String wsBase, String conversationId)
      : _channel = WebSocketChannel.connect(Uri.parse('$wsBase/api/chat/ws/$conversationId'));

  final WebSocketChannel _channel;

  Stream<ChatStreamEvent> get events => _channel.stream.map((raw) {
        final json = jsonDecode(raw as String) as Map<String, dynamic>;
        switch (json['type']) {
          case 'token':
            return ChatToken(json['content'] as String);
          case 'error':
            return ChatError(json['detail'] as String);
          default:
            return ChatDone();
        }
      });

  void send(String content) {
    _channel.sink.add(jsonEncode({'content': content}));
  }

  Future<void> close() => _channel.sink.close();
}
