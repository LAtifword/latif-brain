class Conversation {
  Conversation({
    required this.id,
    required this.agentId,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
        id: json['id'] as String,
        agentId: json['agent_id'] as String,
        title: json['title'] as String,
        createdAt: DateTime.tryParse(json['created_at'] as String) ?? DateTime.now(),
        updatedAt: DateTime.tryParse(json['updated_at'] as String) ?? DateTime.now(),
      );

  final String id;
  final String agentId;
  final String title;
  final DateTime createdAt;
  final DateTime updatedAt;
}
