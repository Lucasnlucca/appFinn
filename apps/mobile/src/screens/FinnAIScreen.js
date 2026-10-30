import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

export default function FinnAIScreen() {
  const insets = useSafeAreaInsets();
  const { aiChat, sendAiMessage, members } = useFinance();
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef();

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [aiChat]);

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;
    setInputText('');
    await sendAiMessage(text.trim());
  };

  const quickPrompts = [
    'Gastei 55 no mercado',
    'Qual o nosso saldo atual?',
    'Como podemos economizar?',
    'Lançar 120 de energia',
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER DA IA */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarWrap}>
            <Ionicons name="sparkles" size={20} color={COLORS.primary} />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>FINN AI</Text>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>Assistente do Casal ({members.user1} & {members.user2})</Text>
          </View>
        </View>
      </View>

      {/* CHAT MESSAGES SCROLL */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {aiChat.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <View
              key={msg.id}
              style={[styles.messageBubbleWrap, isUser ? styles.userBubbleWrap : styles.aiBubbleWrap]}
            >
              {!isUser && (
                <View style={styles.aiAvatarSmall}>
                  <Ionicons name="hardware-chip" size={14} color={COLORS.primary} />
                </View>
              )}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : styles.aiBubbleText]}>
                  {msg.text}
                </Text>
                <Text style={[styles.timeText, isUser ? styles.userTimeText : styles.aiTimeText]}>
                  {msg.time}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* SUGESTÕES RÁPIDAS (PROMPT PILLS) */}
      <View style={styles.quickPromptsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsList}>
          {quickPrompts.map((p, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptPill}
              onPress={() => handleSend(p)}
            >
              <Ionicons name="flash-outline" size={13} color={COLORS.primary} />
              <Text style={styles.promptPillText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* INPUT BAR FIXO NO RODAPÉ */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.textInput}
            placeholder='Fale com o FINN (ex: "Gastei 45 no almoço")...'
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            disabled={!inputText.trim()}
            onPress={() => handleSend()}
          >
            <Ionicons name="arrow-up" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  onlineText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  messageBubbleWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userBubbleWrap: {
    justifyContent: 'flex-end',
  },
  aiBubbleWrap: {
    justifyContent: 'flex-start',
  },
  aiAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleText: {
    color: COLORS.white,
    fontWeight: '500',
  },
  aiBubbleText: {
    color: COLORS.text,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  aiTimeText: {
    color: COLORS.textMuted,
  },
  quickPromptsWrap: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.bg,
  },
  quickPromptsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  promptPillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.surfaceBorder,
    opacity: 0.6,
  },
});
