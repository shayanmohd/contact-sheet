# JS bridge: the WebView calls these by name via reflection.
-keepclassmembers class com.mohdshayan.contactsheet.MainActivity$Native { public *; }
-keep class com.mohdshayan.contactsheet.MainActivity$Native { *; }
