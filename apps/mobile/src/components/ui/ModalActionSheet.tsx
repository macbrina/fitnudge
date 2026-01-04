import React from "react";
import { Modal, View, StyleSheet } from "react-native";
import { ActionSheet, ActionSheetProps } from "./ActionSheet";

export interface ModalActionSheetProps extends ActionSheetProps {}

/**
 * ModalActionSheet - A full-screen modal wrapper for ActionSheet
 *
 * Use this when you need the ActionSheet to cover the entire screen,
 * including bottom tabs. For use inside an existing Modal, use ActionSheet directly.
 *
 * Usage:
 * ```tsx
 * <ModalActionSheet
 *   visible={showOptions}
 *   title="Select Category"
 *   options={[
 *     { id: 'fitness', label: '💪 Fitness', onPress: () => setCategory('fitness') },
 *     { id: 'nutrition', label: '🥗 Nutrition', onPress: () => setCategory('nutrition') },
 *   ]}
 *   onClose={() => setShowOptions(false)}
 * />
 * ```
 */
export function ModalActionSheet(props: ModalActionSheetProps) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      <View style={styles.container}>
        <ActionSheet {...props} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
