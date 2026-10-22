import 'package:flutter/material.dart';

/// Dark, cyberpunk-green glassmorphism theme used throughout AgentOS.
class AppColors {
  AppColors._();

  static const background = Color(0xFF06100C);
  static const surface = Color(0xFF0B1A14);
  static const surfaceGlass = Color(0x1A22C55E);
  static const border = Color(0x3322C55E);
  static const primary = Color(0xFF22E37A);
  static const primaryDim = Color(0xFF17A85A);
  static const textPrimary = Color(0xFFEAFBF1);
  static const textSecondary = Color(0xFF8FB6A2);
  static const danger = Color(0xFFFF5470);
  static const warning = Color(0xFFF6C453);
}

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: base.colorScheme.copyWith(
        brightness: Brightness.dark,
        primary: AppColors.primary,
        secondary: AppColors.primaryDim,
        surface: AppColors.surface,
        error: AppColors.danger,
      ),
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppColors.textPrimary,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.border),
        ),
      ),
      dividerColor: AppColors.border,
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.surfaceGlass,
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontSize: 11, color: AppColors.textSecondary),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceGlass,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.black,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.surface,
        contentTextStyle: TextStyle(color: AppColors.textPrimary),
      ),
    );
  }
}

/// A translucent bordered card used for the glassmorphism look across
/// dashboard stat tiles, agent tiles, and panels.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.glowColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? glowColor;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: glowColor != null
            ? [BoxShadow(color: glowColor!.withOpacity(0.25), blurRadius: 18)]
            : null,
      ),
      child: child,
    );

    if (onTap == null) return card;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: card,
    );
  }
}

class StatusDot extends StatelessWidget {
  const StatusDot({super.key, required this.online, this.label});

  final bool online;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final color = online ? AppColors.primary : AppColors.textSecondary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        if (label != null) ...[
          const SizedBox(width: 6),
          Text(label!, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ],
    );
  }
}
