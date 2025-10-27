import { useTranslation } from "@/lib/i18n";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

export default function FeedScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("feed.title")}</Text>
        <Text style={styles.subtitle}>{t("feed.subtitle")}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("feed.ai_motivation")}</Text>
          <Text style={styles.cardText}>{t("feed.ai_quote_1")}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>
              {t("feed.time_ago", { hours: 2 })}
            </Text>
            <View style={styles.reactionButtons}>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionButtonText}>💪</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionButtonText}>🔥</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Community Post</Text>
          <Text style={styles.cardText}>
            "Just finished an amazing workout! The energy is incredible today
            💪"
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>@fitnessfan • 1 hour ago</Text>
            <View style={styles.reactionButtons}>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionButtonText}>❤️ 5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionButtonText}>💬 2</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Motivation</Text>
          <Text style={styles.cardText}>
            "Consistency is key! You're building habits that will last a
            lifetime. Keep going! 🌟"
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>4 hours ago</Text>
            <View style={styles.reactionButtons}>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionButtonText}>💪</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionButtonText}>🔥</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    padding: 24,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
  },
  content: {
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    color: "#0f172a",
    lineHeight: 24,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardFooterText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  reactionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  reactionButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionButtonText: {
    fontSize: 14,
    color: "#374151",
  },
});
