import 'dart:convert';

import 'package:http/http.dart' as http;

import '../state/backend_config.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Thin REST client for the AgentOS FastAPI backend. Every call surfaces
/// real failures (timeouts, connection refused, non-2xx) as [ApiException]
/// rather than swallowing them — callers decide how to show that honestly.
class ApiClient {
  ApiClient(this._config);

  final BackendConfig _config;
  static const _timeout = Duration(seconds: 10);

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    if (!_config.isConfigured) {
      throw ApiException('No backend configured yet.');
    }
    return Uri.parse('${_config.httpBase}$path').replace(
      queryParameters: query?.map((k, v) => MapEntry(k, v.toString())),
    );
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await http.get(_uri(path, query)).timeout(_timeout);
      return _decode(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Could not reach backend at ${_config.httpBase}: $e');
    }
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body, Map<String, dynamic>? query}) async {
    try {
      final response = await http
          .post(
            _uri(path, query),
            headers: {'Content-Type': 'application/json'},
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(_timeout);
      return _decode(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Could not reach backend at ${_config.httpBase}: $e');
    }
  }

  dynamic _decode(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    String detail = response.body;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['detail'] != null) {
        detail = decoded['detail'].toString();
      }
    } catch (_) {}
    throw ApiException('${response.statusCode}: $detail');
  }
}
