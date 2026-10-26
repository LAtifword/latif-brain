enum AgentStatus { online, offline, notImplemented }

AgentStatus _statusFromString(String value) {
  switch (value) {
    case 'online':
      return AgentStatus.online;
    case 'offline':
      return AgentStatus.offline;
    default:
      return AgentStatus.notImplemented;
  }
}

class AgentInfo {
  AgentInfo({
    required this.id,
    required this.name,
    required this.category,
    required this.description,
    required this.icon,
    required this.implemented,
    required this.status,
    required this.capabilities,
  });

  factory AgentInfo.fromJson(Map<String, dynamic> json) => AgentInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        category: json['category'] as String,
        description: json['description'] as String,
        icon: json['icon'] as String,
        implemented: json['implemented'] as bool,
        status: _statusFromString(json['status'] as String),
        capabilities: (json['capabilities'] as List).cast<String>(),
      );

  final String id;
  final String name;
  final String category;
  final String description;
  final String icon;
  final bool implemented;
  final AgentStatus status;
  final List<String> capabilities;
}
