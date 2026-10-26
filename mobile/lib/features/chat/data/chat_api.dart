import '../../../core/network/api_client.dart';
import '../../../core/state/backend_config.dart';
import '../models/chat_message.dart';
import '../models/conversation.dart';
import 'chat_socket.dart';

class ChatApi {
  ChatApi(this._client, this._config);

  final ApiClient _client;
  final BackendConfig _config;

  Future<Conversation> createConversation(String title) async {
    final json = await _client.post('/api/chat/conversations', query: {'title': title});
    return Conversation.fromJson(json as Map<String, dynamic>);
  }

  Future<List<Conversation>> listConversations() async {
    final json = await _client.get('/api/chat/conversations');
    return (json as List).map((e) => Conversation.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ChatMessage>> listMessages(String conversationId) async {
    final json = await _client.get('/api/chat/conversations/$conversationId/messages');
    return (json as List).map((e) => ChatMessage.fromJson(e as Map<String, dynamic>)).toList();
  }

  ChatSocket openSocket(String conversationId) => ChatSocket(_config.wsBase, conversationId);
}
