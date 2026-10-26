import 'package:flutter/material.dart';

/// Maps the icon key each agent reports from the backend to a concrete
/// Material icon. Kept in one place so dashboard tiles and the agents list
/// always render the same glyph for a given agent.
IconData agentIconFor(String key) {
  switch (key) {
    case 'chat_bubble':
    case 'chat':
    case 'system':
      return Icons.chat_bubble_outline_rounded;
    case 'code':
      return Icons.code_rounded;
    case 'palette':
    case 'design':
      return Icons.palette_outlined;
    case 'assignment':
    case 'project':
      return Icons.assignment_outlined;
    case 'mic':
    case 'audio':
      return Icons.mic_none_rounded;
    case 'movie':
    case 'video':
      return Icons.movie_creation_outlined;
    case 'menu_book':
    case 'book':
      return Icons.menu_book_outlined;
    case 'music_note':
    case 'music':
      return Icons.music_note_rounded;
    case 'flight':
    case 'aircraft':
      return Icons.flight_outlined;
    default:
      return Icons.smart_toy_outlined;
  }
}
