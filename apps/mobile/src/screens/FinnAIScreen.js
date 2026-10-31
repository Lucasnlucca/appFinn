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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// Carregador seguro para evitar crash do 'ExponentAV' no Expo Go
function getAudioModule() {
  try {
    const av = require('expo-av');
    return av?.Audio || null;
  } catch (e) {
    return null;
  }
}

import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

function FormattedMessage({ text, isUser, navigation }) {
  if (isUser) {
    return <Text style={[styles.bubbleText, styles.userBubbleText]}>{text}</Text>;
  }

  const isKeyWarning = text.includes('Chave') || text.includes('aistudio.google.com') || text.includes('Revogada');
  const paragraphs = text.split('\n');

  return (
    <View style={styles.formattedWrap}>
      {paragraphs.map((paragraph, pIdx) => {
        if (!paragraph.trim()) {
          return <View key={pIdx} style={{ height: 6 }} />;
        }

        const parts = paragraph.split(/(\*\*.*?\*\*)/g);
        const isBullet = paragraph.trim().startsWith('•') || paragraph.trim().startsWith('-');

        return (
          <Text
            key={pIdx}
            style={[
              styles.bubbleText,
              styles.aiBubbleText,
              isBullet && styles.bulletText,
            ]}
          >
            {parts.map((part, partIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <Text key={partIdx} style={styles.boldAiText}>
                    {part.slice(2, -2)}
                  </Text>
                );
              }
              return part;
            })}
          </Text>
        );
      })}

      {isKeyWarning && navigation && (
        <TouchableOpacity
          style={styles.keyWarningActionBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="key-outline" size={15} color={COLORS.primary} />
          <Text style={styles.keyWarningActionText}>Ir para Configurações e Colar Chave</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function FinnAIScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    aiChat,
    sendAiMessage,
    processReceiptMedia,
    processPdfInvoice,
    processAudioMessage,
    members,
    loggedInUser,
  } = useFinance();

  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const scrollViewRef = useRef();
  const timerRef = useRef(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [aiChat, analyzing]);

  // Limpa gravação caso tela seja desmontada
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  // Enviar mensagem de texto
  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || analyzing) return;
    setInputText('');
    setAnalyzing(true);
    setAnalyzingStatus('FINN pensando...');
    try {
      await sendAiMessage(text.trim());
    } finally {
      setAnalyzing(false);
    }
  };

  // 1. ANEXAR PRINT OU FOTO DO COMPROVANTE
  const handlePickReceipt = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria para enviar comprovantes.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAnalyzing(true);
        setAnalyzingStatus('Analisando comprovante com Google Gemini...');
        const mime = asset.mimeType || 'image/jpeg';
        await processReceiptMedia(asset.base64, mime);
      }
    } catch (e) {
      Alert.alert('Erro ao carregar imagem', e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // 2. ANEXAR PDF DE NOTA OU FATURA
  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAnalyzing(true);
        setAnalyzingStatus('Lendo boleto / fatura em PDF...');

        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await processPdfInvoice(base64);
      }
    } catch (e) {
      Alert.alert('Erro ao carregar PDF', e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. ANEXAR ARQUIVO DE ÁUDIO (MENSAGEM DE VOZ / WHATSAPP)
  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/m4a', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/aac'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAnalyzing(true);
        setAnalyzingStatus('Ouvindo áudio com o Google Gemini...');

        const base64Audio = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const mime = asset.mimeType || 'audio/m4a';
        await processAudioMessage(base64Audio, mime);
      }
    } catch (e) {
      Alert.alert('Erro ao carregar áudio', e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // 4. GRAVAÇÃO DE ÁUDIO DE VOZ NATIVO
  const startRecording = async () => {
    const AudioModule = getAudioModule();
    if (!AudioModule) {
      Alert.alert(
        'Mensagem de Voz',
        'Deseja selecionar um arquivo de áudio gravado (ex: WhatsApp ou Gravador de Voz) para a IA FINN escutar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Escolher Áudio', onPress: handlePickAudio },
        ]
      );
      return;
    }

    try {
      const permission = await AudioModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microfone', 'Permissão de microfone necessária para mensagens de voz.');
        return;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await AudioModule.Recording.createAsync(
        AudioModule.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      Alert.alert(
        'Gravação Indisponível',
        'Deseja selecionar um áudio gravado para a IA analisar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Selecionar Áudio', onPress: handlePickAudio },
        ]
      );
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    try {
      clearInterval(timerRef.current);
      setAnalyzing(true);
      setAnalyzingStatus('Ouvindo áudio com o Google Gemini...');

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await processAudioMessage(base64Audio, 'audio/m4a');
      }
    } catch (err) {
      Alert.alert('Erro ao processar áudio', err.message);
    } finally {
      setAnalyzing(false);
      setRecordingDuration(0);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    try {
      clearInterval(timerRef.current);
      await recording.stopAndUnloadAsync();
    } catch {}
    setRecording(null);
    setRecordingDuration(0);
  };

  const quickPrompts = [
    'Qual o nosso saldo atual?',
    'Gastei 55 no mercado',
    'O que acha de pedirmos pizza?',
    'Como podemos economizar esse mês?',
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER DA IA */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation?.canGoBack() && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.navy} />
            </TouchableOpacity>
          )}
          <View style={styles.avatarWrap}>
            <Ionicons name="sparkles" size={20} color={COLORS.navy} />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>FINN AI</Text>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Google Gemini</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Assistente do Casal ({members.user1} & {members.user2})
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsMiniBtn}
          onPress={() => navigation?.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
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
                  <Ionicons name="sparkles" size={13} color={COLORS.primary} />
                </View>
              )}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <FormattedMessage text={msg.text} isUser={isUser} navigation={navigation} />

                {/* Card de Transação Lançada Automaticamente */}
                {msg.transaction && (
                  <View style={styles.txCardInChat}>
                    <View style={styles.txCardHeader}>
                      <Ionicons
                        name={msg.transaction.type === 'income' ? 'arrow-up-circle' : 'arrow-down-circle'}
                        size={16}
                        color={msg.transaction.type === 'income' ? COLORS.income : COLORS.expense}
                      />
                      <Text style={styles.txCardDesc}>{msg.transaction.description}</Text>
                      <Text
                        style={[
                          styles.txCardAmount,
                          { color: msg.transaction.type === 'income' ? COLORS.income : COLORS.expense },
                        ]}
                      >
                        R$ {msg.transaction.amount?.toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                    <Text style={styles.txCardSub}>
                      Lançado para {msg.transaction.author} • Extrato atualizado
                    </Text>
                  </View>
                )}

                <Text style={[styles.timeText, isUser ? styles.userTimeText : styles.aiTimeText]}>
                  {msg.time}
                </Text>
              </View>
            </View>
          );
        })}

        {/* LOADING INDICATOR QUANDO ANALISANDO COM GEMINI */}
        {analyzing && (
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.analyzingText}>{analyzingStatus}</Text>
          </View>
        )}
      </ScrollView>

      {/* PAINEL DE GRAVAÇÃO ATIVA DE ÁUDIO */}
      {recording ? (
        <View style={[styles.recordingBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.recordingIndicator}>
            <View style={styles.redRecDot} />
            <Text style={styles.recordingTimer}>
              Gravando áudio: {Math.floor(recordingDuration / 60)}:
              {(recordingDuration % 60).toString().padStart(2, '0')}
            </Text>
          </View>

          <View style={styles.recordingActions}>
            <TouchableOpacity style={styles.cancelRecBtn} onPress={cancelRecording}>
              <Ionicons name="trash-outline" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sendRecBtn} onPress={stopRecordingAndSend}>
              <Ionicons name="send" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* BARRA DE ATALHOS MULTIMODAIS (PRINT, PDF, ÁUDIO) */}
          <View style={styles.multimodalBar}>
            <TouchableOpacity style={styles.multimodalBtn} onPress={handlePickReceipt} disabled={analyzing}>
              <Ionicons name="camera-outline" size={17} color={COLORS.primary} />
              <Text style={styles.multimodalBtnText}>Comprovante</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.multimodalBtn} onPress={handlePickPdf} disabled={analyzing}>
              <Ionicons name="document-text-outline" size={17} color="#3B82F6" />
              <Text style={styles.multimodalBtnText}>Boleto / PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.multimodalBtn} onPress={startRecording} disabled={analyzing}>
              <Ionicons name="mic-outline" size={17} color="#EC4899" />
              <Text style={styles.multimodalBtnText}>Gravar Áudio</Text>
            </TouchableOpacity>
          </View>

          {/* SUGESTÕES RÁPIDAS (PROMPT PILLS) */}
          <View style={styles.quickPromptsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPromptsList}
            >
              {quickPrompts.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.promptPill}
                  onPress={() => handleSend(p)}
                  disabled={analyzing}
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
                placeholder={`Fale com o FINN (${members.user1} ou ${members.user2})...`}
                placeholderTextColor={COLORS.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                editable={!analyzing}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || analyzing) && styles.sendBtnDisabled]}
                disabled={!inputText.trim() || analyzing}
                onPress={() => handleSend()}
              >
                <Ionicons name="arrow-up" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
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
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  settingsMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageBubbleWrap: {
    flexDirection: 'row',
    marginVertical: 4,
    maxWidth: '85%',
  },
  userBubbleWrap: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  aiBubbleWrap: {
    alignSelf: 'flex-start',
    gap: 8,
  },
  aiAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderBottomLeftRadius: 4,
  },
  formattedWrap: {
    gap: 4,
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
  boldAiText: {
    fontWeight: '800',
    color: COLORS.navy,
  },
  bulletText: {
    paddingLeft: 6,
  },
  keyWarningActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  keyWarningActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 10,
    marginTop: 6,
  },
  userTimeText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  aiTimeText: {
    color: COLORS.textMuted,
  },
  txCardInChat: {
    backgroundColor: COLORS.surfaceLight,
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  txCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txCardDesc: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  txCardAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  txCardSub: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  analyzingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginTop: 4,
  },
  analyzingText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  multimodalBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  multimodalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  multimodalBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  quickPromptsWrap: {
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  quickPromptsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  promptPillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redRecDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.expense,
  },
  recordingTimer: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelRecBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendRecBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
