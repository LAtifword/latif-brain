# ProGuard/R8 rules for LATIF NI Android application

# Preserve line numbers for debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep all model classes for Gson serialization/deserialization
-keep class com.latif.ni.service.** { *; }
-keep class com.latif.ni.ui.** { *; }
-keep class com.latif.ni.model.** { *; }

# Gson rules
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

-keep class com.google.gson.** { *; }
-keepclassmembers enum * { *; }

# Retrofit rules
-keep class retrofit2.** { *; }
-keepclassmembers class * {
    @retrofit2.http.* <methods>;
}

# OkHttp rules
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keepclassmembers class okhttp3.** {
  public *;
}

# Kotlin rules
-keep class kotlin.** { *; }
-keep interface kotlin.** { *; }
-keepclassmembers class kotlin.Metadata {
    public static *** read(java.lang.Class);
    public synthetic <init>(int, int[], int[], int, int, int, int, kotlin.jvm.internal.DefaultConstructorMarker);
}

# Coroutines rules
-keep class kotlinx.coroutines.** { *; }
-keep interface kotlinx.coroutines.** { *; }

# Android Lifecycle
-keep class androidx.lifecycle.** { *; }
-keep interface androidx.lifecycle.** { *; }

# Material Design
-keep class com.google.android.material.** { *; }
-keep interface com.google.android.material.** { *; }

# Android AppCompat
-keep class androidx.appcompat.** { *; }
-keep interface androidx.appcompat.** { *; }

# WebView
-keep class android.webkit.** { *; }

# Timber logging
-keep class timber.log.Timber* { *; }

# Reflection for WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve all application classes
-keep class com.latif.ni.** { *; }

# Avoid stripping of native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Preserve custom application classes
-keep class * extends android.app.Activity
-keep class * extends android.app.Service
-keep class * extends android.app.BroadcastReceiver
-keep class * extends android.content.ContentProvider
-keep class * extends android.app.backup.BackupAgentHelper

# Keep R class (resources)
-keep class **.R$* { *; }

# Remove logging in release builds (optional)
# -assumenosideeffects class android.util.Log {
#     public static *** d(...);
#     public static *** v(...);
# }
