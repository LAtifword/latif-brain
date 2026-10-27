class ActivityItem {
  ActivityItem({
    required this.id,
    required this.agentId,
    required this.action,
    required this.detail,
    required this.createdAt,
  });

  factory ActivityItem.fromJson(Map<String, dynamic> json) => ActivityItem(
        id: json['id'] as int,
        agentId: json['agent_id'] as String,
        action: json['action'] as String,
        detail: json['detail'] as String,
        createdAt: DateTime.tryParse(json['created_at'] as String) ?? DateTime.now(),
      );

  final int id;
  final String agentId;
  final String action;
  final String detail;
  final DateTime createdAt;
}
