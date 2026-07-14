enum ChatRole { system, user, assistant }

ChatRole roleFromString(String value) {
  switch (value) {
    case 'user':
      return ChatRole.user;
    case 'assistant':
      return ChatRole.assistant;
    default:
      return ChatRole.system;
  }
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.isStreaming = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        role: roleFromString(json['role'] as String),
        content: json['content'] as String,
        createdAt: DateTime.tryParse(json['created_at'] as String) ?? DateTime.now(),
      );

  final String id;
  final ChatRole role;
  String content;
  final DateTime createdAt;
  bool isStreaming;
}
