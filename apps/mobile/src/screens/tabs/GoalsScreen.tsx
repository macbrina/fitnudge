import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "@/lib/i18n";

export default function GoalsScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("goals.title")}</Text>
        <Text style={styles.subtitle}>{t("goals.subtitle")}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("goals.active_goals")}</Text>
          <Text style={styles.cardText}>{t("goals.no_goals_message")}</Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>{t("goals.create_goal")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("goals.categories")}</Text>
          <View style={styles.categoryGrid}>
            <TouchableOpacity style={styles.categoryButton}>
              <Text style={styles.categoryButtonText}>
                {t("goals.category_fitness")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryButton}>
              <Text style={styles.categoryButtonText}>
                {t("goals.category_nutrition")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryButton}>
              <Text style={styles.categoryButtonText}>
                {t("goals.category_wellness")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryButton}>
              <Text style={styles.categoryButtonText}>
                {t("goals.category_sleep")}
              </Text>
            </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    color: "#6b7280",
    lineHeight: 24,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
  },
  categoryButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "500",
  },
});
