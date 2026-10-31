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
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as Speech from 'expo-speech';

import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

// Limpa texto para fala natural no sintetizador de voz (sem markdown e sem emojis)
function cleanTextForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/\[TRANSACTION:[\s\S]*?\]/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/🎙️\s*Você disse:\s*".*?"/gi, '')
    .replace(/[🍔🎬📚🏷️🎮🏠📦🐾🎁💰💊🚕👕✈️🎯✨⚡📌•#—\(\)]/g, '')
    .trim();
}

function FormattedMessage({ text, isUser, navigation, onSpeak, isSpeaking }) {
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

      {/* BOTÃO PARA OUVIR A RESPOSTA DA IA */}
      <TouchableOpacity
        style={[styles.listenBtn, isSpeaking && styles.listenBtnActive]}
        onPress={onSpeak}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isSpeaking ? 'volume-high' : 'volume-medium-outline'}
          size={14}
          color={isSpeaking ? '#0284C7' : COLORS.textSecondary}
        />
        <Text style={[styles.listenBtnText, isSpeaking && styles.listenBtnTextActive]}>
          {isSpeaking ? 'Parar voz' : 'Ouvir resposta'}
        </Text>
      </TouchableOpacity>
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
  } = useFinance();

  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');

  // Gravador de Áudio Oficial do Expo (SDK 58)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordTimerRef = useRef(null);

  // Sintetizador de Voz (Speech)
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  // MODAL GEMINI LIVE (Conversação contínua estilo IA do Gemini)
  const [liveModalVisible, setLiveModalVisible] = useState(false);
  const [liveState, setLiveState] = useState('idle'); // 'idle' | 'recording' | 'thinking' | 'speaking'
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAiTranscript, setLiveAiTranscript] = useState('');
  const [liveDuration, setLiveDuration] = useState(0);
  const liveTimerRef = useRef(null);

  // Animação da Esfera Gemini Live
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0.4)).current;
  const orbAnimLoop = useRef(null);

  const scrollViewRef = useRef();

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [aiChat, analyzing]);

  // Limpa gravação e timers ao desmontar tela
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      Speech.stop();
      try {
        audioRecorder.stop();
      } catch {}
    };
  }, []);

  // Controla pulsação da esfera visual no Gemini Live
  useEffect(() => {
    if (orbAnimLoop.current) {
      orbAnimLoop.current.stop();
    }

    if (liveState === 'recording' || liveState === 'speaking') {
      orbAnimLoop.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 1.25, duration: 700, useNativeDriver: true }),
            Animated.timing(orbGlow, { toValue: 0.9, duration: 700, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 1.0, duration: 700, useNativeDriver: true }),
            Animated.timing(orbGlow, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      orbAnimLoop.current.start();
    } else if (liveState === 'thinking') {
      orbAnimLoop.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 1.12, duration: 400, useNativeDriver: true }),
            Animated.timing(orbGlow, { toValue: 0.7, duration: 400, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 0.95, duration: 400, useNativeDriver: true }),
            Animated.timing(orbGlow, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          ]),
        ])
      );
      orbAnimLoop.current.start();
    } else {
      // Idle
      orbAnimLoop.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 1.05, duration: 1600, useNativeDriver: true }),
            Animated.timing(orbGlow, { toValue: 0.5, duration: 1600, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 1.0, duration: 1600, useNativeDriver: true }),
            Animated.timing(orbGlow, { toValue: 0.3, duration: 1600, useNativeDriver: true }),
          ]),
        ])
      );
      orbAnimLoop.current.start();
    }
  }, [liveState]);

  // Formatar tempo 00:00
  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 1. REPRODUZIR VOZ (TEXT-TO-SPEECH)
  const handleSpeak = (msgId, text) => {
    if (speakingMsgId === msgId) {
      Speech.stop();
      setSpeakingMsgId(null);
      return;
    }
    Speech.stop();
    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    setSpeakingMsgId(msgId);
    Speech.speak(clean, {
      language: 'pt-BR',
      rate: 1.05,
      pitch: 1.0,
      onDone: () => setSpeakingMsgId(null),
      onStopped: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null),
    });
  };

  // 2. ENVIAR MENSAGEM DE TEXTO
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

  // 3. ANEXAR FOTO DO COMPROVANTE
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

  // 4. ANEXAR PDF
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

  // 5. ANEXAR ARQUIVO DE ÁUDIO (FALLBACK DOCUMENT PICKER)
  const handlePickAudioFile = async () => {
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

  // =========================================================================
  // GRAVAÇÃO DE ÁUDIO ESTILO WHATSAPP
  // =========================================================================
  const startRecordingWhatsApp = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Permissão de Microfone',
          'Permita o acesso ao microfone para enviar mensagens de áudio para a IA.'
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Erro ao gravar áudio nativo:', err);
      // Se der qualquer impedimento, abre o selecionador seguro
      handlePickAudioFile();
    }
  };

  const stopAndSendRecordingWhatsApp = async () => {
    if (!isRecording) return;
    try {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);

      setAnalyzing(true);
      setAnalyzingStatus('FINN ouvindo seu áudio...');

      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (uri) {
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const result = await processAudioMessage(base64Audio, 'audio/m4a');
        if (result?.text) {
          // Fala a resposta automaticamente se for mensagem por voz
          handleSpeak('auto-' + Date.now(), result.text);
        }
      }
    } catch (err) {
      Alert.alert('Erro ao enviar áudio', err.message);
    } finally {
      setAnalyzing(false);
      setRecordingSeconds(0);
    }
  };

  const cancelRecordingWhatsApp = async () => {
    if (!isRecording) return;
    try {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);
      await audioRecorder.stop();
    } catch {}
    setRecordingSeconds(0);
  };

  // =========================================================================
  // MODO CONVERSAÇÃO ESTILO GEMINI LIVE (CHAMADA DE VOZ INTERATIVA)
  // =========================================================================
  const openGeminiLive = () => {
    Speech.stop();
    setLiveState('idle');
    setLiveUserTranscript('');
    setLiveAiTranscript('');
    setLiveDuration(0);
    setLiveModalVisible(true);

    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    liveTimerRef.current = setInterval(() => {
      setLiveDuration((prev) => prev + 1);
    }, 1000);
  };

  const closeGeminiLive = () => {
    Speech.stop();
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    try {
      audioRecorder.stop();
    } catch {}
    setLiveModalVisible(false);
    setLiveState('idle');
  };

  const handleLiveToggleRecording = async () => {
    if (liveState === 'speaking') {
      Speech.stop();
      setLiveState('idle');
      return;
    }

    if (liveState === 'recording') {
      // Para de gravar e envia para a IA
      try {
        setLiveState('thinking');
        await audioRecorder.stop();
        const uri = audioRecorder.uri;

        if (uri) {
          const base64Audio = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const res = await processAudioMessage(base64Audio, 'audio/m4a');

          if (res?.text) {
            setLiveAiTranscript(res.text);
            const userSaidMatch = res.text.match(/Você disse:\s*"(.*?)"/i);
            if (userSaidMatch) {
              setLiveUserTranscript(userSaidMatch[1]);
            }

            setLiveState('speaking');
            const clean = cleanTextForSpeech(res.text);
            Speech.speak(clean, {
              language: 'pt-BR',
              rate: 1.05,
              pitch: 1.0,
              onDone: () => setLiveState('idle'),
              onStopped: () => setLiveState('idle'),
              onError: () => setLiveState('idle'),
            });
          } else {
            setLiveState('idle');
          }
        } else {
          setLiveState('idle');
        }
      } catch (err) {
        Alert.alert('Erro ao conversar', err.message);
        setLiveState('idle');
      }
    } else {
      // Começa a gravar
      try {
        Speech.stop();
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          Alert.alert('Permissão de Microfone', 'Permita o microfone para falar com a FINN.');
          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setLiveState('recording');
      } catch (err) {
        Alert.alert('Erro no microfone', err.message);
        setLiveState('idle');
      }
    }
  };

  const quickPrompts = [
    'Qual o nosso saldo atual?',
    'Gastei 55 no mercado no débito',
    'Entrou 800 do meu freela',
    'O que acha de pedirmos pizza hoje?',
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* HEADER DA IA */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation?.canGoBack() && (
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
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
                <Text style={styles.onlineText}>Gemini 2.5</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Assistente do Casal ({members.user1} & {members.user2})
            </Text>
          </View>
        </View>

        <View style={styles.headerRightGroup}>
          {/* BOTÃO MODO CONVERSA GEMINI LIVE */}
          <TouchableOpacity
            style={styles.geminiLiveHeaderBtn}
            onPress={openGeminiLive}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#06B6D4', '#8B5CF6']}
              style={styles.liveGradientPill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="sparkles" size={13} color={COLORS.white} />
              <Text style={styles.liveBtnText}>Gemini Live</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsMiniBtn}
            onPress={() => navigation?.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
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
                  <Ionicons name="sparkles" size={13} color={COLORS.primary} />
                </View>
              )}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <FormattedMessage
                  text={msg.text}
                  isUser={isUser}
                  navigation={navigation}
                  onSpeak={() => handleSpeak(msg.id, msg.text)}
                  isSpeaking={speakingMsgId === msg.id}
                />

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
            <ActivityIndicator size="small" color="#0284C7" />
            <Text style={styles.analyzingText}>{analyzingStatus}</Text>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* BARRA INFERIOR: MODO GRAVAÇÃO ESTILO WHATSAPP VS BARRA NORMAL DE INPUT    */}
      {/* ========================================================================= */}
      {isRecording ? (
        <View style={[styles.whatsappRecordBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Lixeira de Cancelar */}
          <TouchableOpacity
            style={styles.cancelRecordBtn}
            onPress={cancelRecordingWhatsApp}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>

          {/* Ponto Vermelho e Contador */}
          <View style={styles.recordTimerWrap}>
            <View style={styles.blinkingRedDot} />
            <Text style={styles.recordingTimerText}>{formatTimer(recordingSeconds)}</Text>
            <Text style={styles.recordingWaveText}>Gravando áudio...</Text>
          </View>

          {/* Botão de Enviar Áudio */}
          <TouchableOpacity
            style={styles.sendRecordBtn}
            onPress={stopAndSendRecordingWhatsApp}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* BARRA DE ATALHOS MULTIMODAIS (PRINT, PDF, CONVERSA) */}
          <View style={styles.multimodalBar}>
            <TouchableOpacity
              style={styles.multimodalBtn}
              onPress={handlePickReceipt}
              disabled={analyzing}
            >
              <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
              <Text style={styles.multimodalBtnText}>Comprovante</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.multimodalBtn}
              onPress={handlePickPdf}
              disabled={analyzing}
            >
              <Ionicons name="document-text-outline" size={16} color="#3B82F6" />
              <Text style={styles.multimodalBtnText}>Boleto / PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.multimodalBtn}
              onPress={openGeminiLive}
              disabled={analyzing}
            >
              <Ionicons name="mic-outline" size={16} color="#06B6D4" />
              <Text style={styles.multimodalBtnText}>Gemini Live</Text>
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
                  <Ionicons name="flash-outline" size={12} color="#0284C7" />
                  <Text style={styles.promptPillText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* INPUT BAR FIXO NO RODAPÉ COM MICROFONE ESTILO WHATSAPP */}
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

              {inputText.trim().length > 0 ? (
                /* Botão de Enviar Texto quando há algo digitado */
                <TouchableOpacity
                  style={[styles.sendBtn, analyzing && styles.sendBtnDisabled]}
                  disabled={analyzing}
                  onPress={() => handleSend()}
                >
                  <Ionicons name="arrow-up" size={20} color={COLORS.white} />
                </TouchableOpacity>
              ) : (
                /* Botão de Microfone Estilo WhatsApp quando não há texto */
                <TouchableOpacity
                  style={styles.whatsappMicBtn}
                  onPress={startRecordingWhatsApp}
                  disabled={analyzing}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mic" size={22} color={COLORS.white} />
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL FULL-SCREEN: CONVERSAÇÃO POR VOZ ESTILO GEMINI LIVE                 */}
      {/* ========================================================================= */}
      <Modal visible={liveModalVisible} animationType="slide" transparent={false}>
        <View style={[styles.liveContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
          <StatusBar barStyle="light-content" backgroundColor="#070B14" />

          {/* Topo da Chamada Live */}
          <View style={styles.liveHeader}>
            <View style={styles.liveHeaderLeft}>
              <View style={styles.liveOnlineDot} />
              <View>
                <Text style={styles.liveTitle}>FINN Live</Text>
                <Text style={styles.liveTimerText}>{formatTimer(liveDuration)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.liveCloseBtn} onPress={closeGeminiLive}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Centro: Esfera Interativa Animada (Estilo Gemini Live) */}
          <View style={styles.liveCenter}>
            <View style={styles.orbContainer}>
              {/* Anel Externo Fluido */}
              <Animated.View
                style={[
                  styles.outerHalo,
                  {
                    transform: [{ scale: orbScale }],
                    opacity: orbGlow,
                  },
                ]}
              />

              {/* Esfera Principal Gradiente */}
              <Animated.View
                style={[
                  styles.innerOrb,
                  {
                    transform: [{ scale: orbScale }],
                  },
                ]}
              >
                <LinearGradient
                  colors={
                    liveState === 'recording'
                      ? ['#EF4444', '#F97316']
                      : liveState === 'thinking'
                      ? ['#8B5CF6', '#3B82F6']
                      : liveState === 'speaking'
                      ? ['#06B6D4', '#10B981']
                      : ['#0284C7', '#8B5CF6']
                  }
                  style={styles.orbGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={
                      liveState === 'recording'
                        ? 'mic'
                        : liveState === 'thinking'
                        ? 'sync'
                        : liveState === 'speaking'
                        ? 'volume-high'
                        : 'sparkles'
                    }
                    size={46}
                    color={COLORS.white}
                  />
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Status Descritivo */}
            <Text style={styles.liveStatusTitle}>
              {liveState === 'recording'
                ? 'Ouvindo você...'
                : liveState === 'thinking'
                ? 'FINN processando...'
                : liveState === 'speaking'
                ? 'FINN falando...'
                : 'Pronto para conversar'}
            </Text>
            <Text style={styles.liveStatusSubtitle}>
              {liveState === 'recording'
                ? 'Fale o que gastou, recebeu ou tire dúvidas'
                : liveState === 'thinking'
                ? 'Conectando ao Google Gemini...'
                : liveState === 'speaking'
                ? 'Toque na tela se quiser interromper'
                : 'Toque no microfone abaixo e fale naturalmente'}
            </Text>
          </View>

          {/* Legenda Flutuante com Transcrição do Diálogo */}
          {(liveUserTranscript || liveAiTranscript) && (
            <View style={styles.liveCaptionsBox}>
              {liveUserTranscript ? (
                <Text style={styles.captionUserText} numberOfLines={2}>
                  🗣️ <Text style={{ color: '#93C5FD' }}>Você:</Text> "{liveUserTranscript}"
                </Text>
              ) : null}
              {liveAiTranscript ? (
                <Text style={styles.captionAiText} numberOfLines={3}>
                  ✨ <Text style={{ color: '#6EE7B7' }}>FINN:</Text> {cleanTextForSpeech(liveAiTranscript)}
                </Text>
              ) : null}
            </View>
          )}

          {/* Rodapé de Controles da Chamada */}
          <View style={styles.liveControlsRow}>
            {/* Silenciar/Parar fala */}
            <TouchableOpacity
              style={styles.liveSecondaryBtn}
              onPress={() => {
                Speech.stop();
                setLiveState('idle');
              }}
            >
              <Ionicons name="volume-mute-outline" size={24} color={COLORS.white} />
            </TouchableOpacity>

            {/* Microfone Central de Falar */}
            <TouchableOpacity
              style={[
                styles.liveMainMicBtn,
                liveState === 'recording' && styles.liveMainMicBtnRecording,
              ]}
              onPress={handleLiveToggleRecording}
              activeOpacity={0.85}
            >
              <Ionicons
                name={liveState === 'recording' ? 'stop' : liveState === 'speaking' ? 'hand-right' : 'mic'}
                size={34}
                color={COLORS.white}
              />
            </TouchableOpacity>

            {/* Encerrar Chamada */}
            <TouchableOpacity style={styles.liveEndCallBtn} onPress={closeGeminiLive}>
              <Ionicons name="call" size={24} color={COLORS.white} style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  geminiLiveHeaderBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  liveGradientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  settingsMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    paddingVertical: 14,
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
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
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
    backgroundColor: '#0284C7',
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
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  keyWarningActionText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  listenBtnActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderColor: '#0284C7',
  },
  listenBtnText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  listenBtnTextActive: {
    color: '#0284C7',
    fontWeight: '800',
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
    backgroundColor: COLORS.bg,
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
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    paddingVertical: 6,
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
    backgroundColor: COLORS.bg,
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
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  whatsappMicBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  whatsappRecordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  cancelRecordBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTimerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingHorizontal: 12,
  },
  blinkingRedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimerText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  recordingWaveText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  sendRecordBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  /* ESTILOS GEMINI LIVE FULL-SCREEN */
  liveContainer: {
    flex: 1,
    backgroundColor: '#070B14',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  liveHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveOnlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  liveTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveTimerText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  liveCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  orbContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  outerHalo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
  },
  innerOrb: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 12,
  },
  orbGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStatusTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  liveStatusSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
  },
  liveCaptionsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  captionUserText: {
    color: COLORS.white,
    fontSize: 13,
    lineHeight: 18,
  },
  captionAiText: {
    color: COLORS.white,
    fontSize: 13,
    lineHeight: 18,
  },
  liveControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  liveSecondaryBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveMainMicBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  liveMainMicBtnRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  liveEndCallBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
