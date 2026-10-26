class SystemStats {
  SystemStats({
    required this.cpuPercent,
    required this.memoryPercent,
    required this.memoryUsedMb,
    required this.memoryTotalMb,
    required this.diskPercent,
    required this.diskUsedGb,
    required this.diskTotalGb,
    required this.gpuAvailable,
    required this.processCount,
    required this.uptimeSeconds,
    required this.timestamp,
  });

  factory SystemStats.fromJson(Map<String, dynamic> json) => SystemStats(
        cpuPercent: (json['cpu_percent'] as num).toDouble(),
        memoryPercent: (json['memory_percent'] as num).toDouble(),
        memoryUsedMb: (json['memory_used_mb'] as num).toDouble(),
        memoryTotalMb: (json['memory_total_mb'] as num).toDouble(),
        diskPercent: (json['disk_percent'] as num).toDouble(),
        diskUsedGb: (json['disk_used_gb'] as num).toDouble(),
        diskTotalGb: (json['disk_total_gb'] as num).toDouble(),
        gpuAvailable: json['gpu_available'] as bool,
        processCount: json['process_count'] as int,
        uptimeSeconds: (json['uptime_seconds'] as num).toDouble(),
        timestamp: json['timestamp'] as String,
      );

  final double cpuPercent;
  final double memoryPercent;
  final double memoryUsedMb;
  final double memoryTotalMb;
  final double diskPercent;
  final double diskUsedGb;
  final double diskTotalGb;
  final bool gpuAvailable;
  final int processCount;
  final double uptimeSeconds;
  final String timestamp;
}
