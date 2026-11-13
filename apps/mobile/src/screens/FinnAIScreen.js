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
  Image,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { readFileAsBase64, readFileAsText } from '../services/fileHelper';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as Speech from 'expo-speech';

import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

const finnAvatarSource = require('../../assets/finn-ai-avatar.png');
const finnChatHeroSource = require('../../assets/finn-chat-hero.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // Sanitiza qualquer tag [TRANSACTION: ...]
  const safeText = (text || '').replace(/\[TRANSACTION:\s*\{[\s\S]*?\}\]/gi, '').trim();
  const displayText = safeText || 'Lançamento registrado com sucesso!';
  const isKeyWarning =
    displayText.includes('Chave') ||
    displayText.includes('aistudio.google.com') ||
    displayText.includes('Revogada');
  const paragraphs = displayText.split('\n');

  return (
    <View style={styles.formattedWrap}>
      {paragraphs.map((paragraph, pIdx) => {
        if (!paragraph.trim()) {
          return <View key={pIdx} style={{ height: 6 }} />;
        }

        const parts = paragraph.split(/(\*\*.*?\*\*)/g);
        const isBullet =
          paragraph.trim().startsWith('•') || paragraph.trim().startsWith('-');

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
          <Text style={styles.keyWarningActionText}>
            Ir para Configurações e Colar Chave
          </Text>
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
        <Text
          style={[
            styles.listenBtnText,
            isSpeaking && styles.listenBtnTextActive,
          ]}
        >
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
    clearAllData,
    cards,
  } = useFinance();

  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');
  const [attachedFile, setAttachedFile] = useState(null); // { type, name, uri, base64, content, mimeType }

  // Gravador de Áudio Oficial do Expo (SDK 58)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordTimerRef = useRef(null);

  // Sintetizador de Voz (Speech)
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  // Modais de Anexo e Mais Opções
  const [attachModalVisible, setAttachModalVisible] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);

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

  // Conjuntos de Sugestões Rápidas (alternáveis com "Trocar")
  const [quickSetIndex, setQuickSetIndex] = useState(0);
  const quickSuggestionSets = [
    [
      { id: 'mes', icon: 'calendar-outline', text: 'Como foi meu mês?', prompt: 'Como foi o desempenho financeiro do meu mês até agora?' },
      { id: 'gastos', icon: 'trending-up-outline', text: 'Onde mais gastei?', prompt: 'Quais foram minhas maiores despesas e categorias que mais gastei?' },
      { id: 'eco', icon: 'wallet-outline', text: 'Como economizar?', prompt: 'Com base no meu extrato, como posso economizar dinheiro de forma inteligente?' },
      { id: 'meta', icon: 'disc-outline', text: 'Definir meta de economia', prompt: 'Me ajude a definir uma meta realista de economia para este mês.' },
    ],
    [
      { id: 'faturas', icon: 'card-outline', text: 'Faturas em aberto?', prompt: 'Qual o valor total das minhas faturas de cartão de crédito em aberto?' },
      { id: 'saldo', icon: 'cash-outline', text: 'Quanto sobrou hoje?', prompt: 'Qual é o meu saldo livre hoje descontando as despesas fixas?' },
      { id: 'dica', icon: 'bulb-outline', text: 'Dica do dia', prompt: 'Me dê uma dica rápida de educação financeira personalizada para mim.' },
      { id: 'comparar', icon: 'bar-chart-outline', text: 'Comparar com mês passado', prompt: 'Compare meus gastos deste mês com os do mês anterior.' },
    ],
  ];

  const scrollViewRef = useRef();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showHero, setShowHero] = useState(true);

  // Ao abrir ou focar a tela da IA, ela sempre inicia com o boneco (Print 2)
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      setShowHero(true);
    });
    return unsubscribe;
  }, [navigation]);

  // Se o histórico de mensagens for aberto, rola suavemente até o final
  useEffect(() => {
    if (!showHero) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [showHero]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [aiChat, analyzing]);

  // Limpa gravação e timers ao desmontar tela
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      Speech.stop();
      if (audioRecorder && audioRecorder.isRecording) {
        audioRecorder.stop().catch(() => {});
      }
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

  // 2. ENVIAR MENSAGEM DE TEXTO OU ARQUIVO ANEXADO
  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if ((!text.trim() && !attachedFile) || analyzing) return;

    // Sai a tela inicial do boneco e volta o histórico do chat do cliente
    setShowHero(false);
    setInputText('');
    setAnalyzing(true);

    // Se houver arquivo anexado (PDF, CSV, Imagem), processa junto com a observação do usuário
    if (attachedFile) {
      const file = attachedFile;
      setAttachedFile(null);

      try {
        if (file.type === 'pdf') {
          setAnalyzingStatus('Lendo boleto / fatura em PDF...');
          await processPdfInvoice(file.base64, text.trim() || undefined);
        } else if (file.type === 'csv') {
          setAnalyzingStatus('Analisando extrato CSV...');
          const prompt = text.trim()
            ? `[EXTRATO CSV ANEXADO: ${file.name}]\nObservação do usuário: "${text.trim()}"\n\nConteúdo:\n${file.content.slice(0, 3500)}\n\nPor favor, analise as movimentações desse extrato considerando a observação.`
            : `[EXTRATO CSV ANEXADO: ${file.name}]\n${file.content.slice(0, 3500)}\n\nPor favor, analise as movimentações desse extrato e registre as receitas e despesas identificadas.`;
          await sendAiMessage(prompt);
        } else if (file.type === 'image') {
          setAnalyzingStatus('Analisando comprovante...');
          await processReceiptMedia(file.base64, file.mimeType, text.trim() || undefined);
        }
      } catch (err) {
        Alert.alert('Erro ao processar anexo', err.message);
      } finally {
        setAnalyzing(false);
      }
      return;
    }

    setAnalyzingStatus('FINN pensando...');
    try {
      await sendAiMessage(text.trim());
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. ANEXAR FOTO DO COMPROVANTE (GALERIA)
  const handlePickReceipt = async () => {
    setAttachModalVisible(false);
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
        let base64 = asset.base64;
        if (!base64 && asset.uri) {
          base64 = await readFileAsBase64(asset.uri);
        }
        setAttachedFile({
          type: 'image',
          name: asset.fileName || 'comprovante.jpg',
          uri: asset.uri,
          base64,
          mimeType: asset.mimeType || 'image/jpeg',
        });
        setShowHero(false);
      }
    } catch (e) {
      Alert.alert('Erro ao carregar imagem', e.message);
    }
  };

  // 4. TIRAR FOTO DO COMPROVANTE (CÂMERA)
  const handleCameraReceipt = async () => {
    setAttachModalVisible(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera para fotografar comprovantes.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64 = asset.base64;
        if (!base64 && asset.uri) {
          base64 = await readFileAsBase64(asset.uri);
        }
        setAttachedFile({
          type: 'image',
          name: asset.fileName || 'foto_comprovante.jpg',
          uri: asset.uri,
          base64,
          mimeType: asset.mimeType || 'image/jpeg',
        });
        setShowHero(false);
      }
    } catch (e) {
      Alert.alert('Erro na câmera', e.message);
    }
  };

  // 5. ANEXAR PDF (NÃO ENVIA DIRETO: FICA ANEXADO PARA COMPLEMENTAR SE DESEJAR)
  const handlePickPdf = async () => {
    setAttachModalVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64 = await readFileAsBase64(asset.uri);
        setAttachedFile({
          type: 'pdf',
          name: asset.name || 'fatura.pdf',
          uri: asset.uri,
          base64,
          mimeType: 'application/pdf',
        });
        setShowHero(false);
      }
    } catch (e) {
      Alert.alert('Erro ao carregar PDF', e.message);
    }
  };

  // 6. ANEXAR CSV (NÃO ENVIA DIRETO: FICA ANEXADO PARA COMPLEMENTAR SE DESEJAR)
  const handlePickCsv = async () => {
    setAttachModalVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const content = await readFileAsText(asset.uri);
        let base64 = '';
        if (!content) {
          base64 = await readFileAsBase64(asset.uri);
        }
        setAttachedFile({
          type: 'csv',
          name: asset.name || 'extrato.csv',
          uri: asset.uri,
          content,
          base64,
          mimeType: 'text/csv',
        });
        setShowHero(false);
      }
    } catch (e) {
      Alert.alert('Erro ao carregar CSV', e.message);
    }
  };

  // 7. GRAVAÇÃO DE VOZ (MICROFONE)
  const startRecordingWhatsApp = async () => {
    Speech.stop();
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permissão necessária', 'Permita o microfone para enviar áudios.');
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
    }
  };

  const stopAndSendRecordingWhatsApp = async () => {
    if (!isRecording) return;
    try {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);
      setShowHero(false); // Sai a tela do boneco e volta o histórico do chat

      setAnalyzing(true);
      setAnalyzingStatus('FINN ouvindo seu áudio...');

      if (audioRecorder && audioRecorder.isRecording) {
        await audioRecorder.stop().catch(() => {});
      }
      const uri = audioRecorder.uri;

      if (uri) {
        const base64Audio = await readFileAsBase64(uri);
        const result = await processAudioMessage(base64Audio, 'audio/m4a');
        if (result?.text) {
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
      if (audioRecorder && audioRecorder.isRecording) {
        await audioRecorder.stop().catch(() => {});
      }
    } catch {}
    setRecordingSeconds(0);
  };

  // 8. GEMINI LIVE (CHAMADA CONTÍNUA)
  const openGeminiLive = () => {
    setMenuModalVisible(false);
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
    if (audioRecorder && audioRecorder.isRecording) {
      audioRecorder.stop().catch(() => {});
    }
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
      try {
        setLiveState('thinking');
        if (audioRecorder && audioRecorder.isRecording) {
          await audioRecorder.stop().catch(() => {});
        }
        const uri = audioRecorder.uri;

        if (uri) {
          const base64Audio = await readFileAsBase64(uri);
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
      try {
        Speech.stop();
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          Alert.alert('Permissão de Microfone', 'Permita o microfone para falar com o FINN.');
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

  const handleToggleQuickSet = () => {
    setQuickSetIndex((prev) => (prev + 1) % quickSuggestionSets.length);
  };

  const currentQuickSuggestions = quickSuggestionSets[quickSetIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5FC" />

      {/* CABEÇALHO SUPERIOR FIEL AO PRINT 1 COM FOTINHA DO ROBÔ NO LUGAR DAS 3 ESTRELAS */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerCircleBtn}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#18181B" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => setShowHero((prev) => !prev)}
          activeOpacity={0.75}
        >
          <View style={styles.headerTitleRow}>
            {/* FOTINHA DO ROBÔ FINN NO LUGAR DA FOTO COM 3 ESTRELAS */}
            <Image
              source={finnAvatarSource}
              style={styles.headerAvatar}
              resizeMode="cover"
            />
            <Text style={styles.headerTitle}>FINN AI</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {showHero ? 'Seu assistente financeiro' : 'Histórico da conversa • Toque p/ início'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCircleBtn}
          onPress={() => setMenuModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#18181B" />
        </TouchableOpacity>
      </View>

      {/* ÁREA DE ROLAGEM COM O NOVO DESIGN */}
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 85 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* SEÇÃO HERO CENTRAL (COM O BONECO DO SEGUNDO PRINT) */}
          {showHero ? (
            <View style={styles.heroSection}>
            {/* Robô 3D com a aura luminosa */}
            <View style={styles.robotImageWrapper}>
              <Image
                source={finnChatHeroSource}
                style={styles.robotHeroImage}
                resizeMode="contain"
              />
            </View>

            {/* Título Central */}
            <Text style={styles.heroTitle}>Como posso te ajudar hoje?</Text>

            {/* PILULA DUPLA DE ANEXO: [ Anexar PDF | Anexar CSV ] */}
            <View style={styles.dualAttachmentPill}>
              <TouchableOpacity
                style={styles.dualAttachmentHalf}
                activeOpacity={0.75}
                onPress={handlePickPdf}
              >
                <Ionicons name="document-text-outline" size={19} color="#7C3AED" />
                <Text style={styles.dualAttachmentText}>Anexar PDF</Text>
              </TouchableOpacity>

              <View style={styles.dualAttachmentDivider} />

              <TouchableOpacity
                style={styles.dualAttachmentHalf}
                activeOpacity={0.75}
                onPress={handlePickCsv}
              >
                <Ionicons name="grid-outline" size={19} color="#7C3AED" />
                <Text style={styles.dualAttachmentText}>Anexar CSV</Text>
              </TouchableOpacity>
            </View>

            {/* 4 CARDS PRINCIPAIS COM SETA */}
            <View style={styles.actionCardsList}>
              {/* 1. Ver meu resumo financeiro */}
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.8}
                onPress={() =>
                  handleSend(
                    'Gere um resumo financeiro inteligente do meu mês atual, com saldo total, despesas por categoria e sugestões.'
                  )
                }
              >
                <View style={[styles.actionCardIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="bar-chart" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.actionCardText}>Ver meu resumo financeiro</Text>
                <Ionicons name="chevron-forward" size={18} color="#71717A" />
              </TouchableOpacity>

              {/* 2. Planejar o mês */}
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.8}
                onPress={() =>
                  handleSend(
                    'Como devemos planejar nosso orçamento para este mês para bater as metas financeiras?'
                  )
                }
              >
                <View style={[styles.actionCardIconBox, { backgroundColor: '#F3EEFF' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.actionCardText}>Planejar o mês</Text>
                <Ionicons name="chevron-forward" size={18} color="#71717A" />
              </TouchableOpacity>

              {/* 3. Sugestões para economizar */}
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.8}
                onPress={() =>
                  handleSend(
                    'Analise nossos gastos recentes e me dê 3 sugestões práticas e personalizadas para economizarmos dinheiro.'
                  )
                }
              >
                <View style={[styles.actionCardIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="disc-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.actionCardText}>Sugestões para economizar</Text>
                <Ionicons name="chevron-forward" size={18} color="#71717A" />
              </TouchableOpacity>

              {/* 4. Registrar um gasto */}
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.8}
                onPress={() => setAttachModalVisible(true)}
              >
                <View style={[styles.actionCardIconBox, { backgroundColor: '#F3EEFF' }]}>
                  <Ionicons name="receipt-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.actionCardText}>Registrar um gasto</Text>
                <Ionicons name="chevron-forward" size={18} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* SEÇÃO "SUGESTÕES RÁPIDAS" COM BOTÃO "TROCAR" */}
            <View style={styles.quickHeaderRow}>
              <Text style={styles.quickHeaderTitle}>Sugestões rápidas</Text>
              <TouchableOpacity
                style={styles.quickTrocarBtn}
                onPress={handleToggleQuickSet}
                activeOpacity={0.7}
              >
                <Ionicons name="sync-outline" size={15} color="#7C3AED" />
                <Text style={styles.quickTrocarText}>Trocar</Text>
              </TouchableOpacity>
            </View>

            {/* GRADE 2X2 DE SUGESTÕES RÁPIDAS */}
            <View style={styles.quickGrid}>
              {currentQuickSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.quickPill}
                  activeOpacity={0.8}
                  onPress={() => handleSend(item.prompt)}
                >
                  <Ionicons name={item.icon} size={16} color="#7C3AED" />
                  <Text style={styles.quickPillText} numberOfLines={1}>
                    {item.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* BOTÃO PARA ACESSAR O HISTÓRICO SE JÁ HOUVER MENSAGENS */}
            {aiChat.length > 0 && (
              <TouchableOpacity
                style={styles.viewHistoryButton}
                activeOpacity={0.8}
                onPress={() => setShowHero(false)}
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#7C3AED" />
                <Text style={styles.viewHistoryText}>
                  Ver histórico da conversa ({aiChat.length}) →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
            /* HISTÓRICO DE MENSAGENS DO CLIENTE (PRINT 1) */
            <View style={styles.chatMessagesContainer}>
              {/* Botão no topo do chat para retornar às sugestões e boneco */}
              <TouchableOpacity
                style={styles.backToHeroBtn}
                onPress={() => setShowHero(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles" size={14} color="#7C3AED" />
                <Text style={styles.backToHeroText}>Início & Sugestões da IA</Text>
              </TouchableOpacity>

              {aiChat.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubbleWrap,
                      isUser ? styles.userBubbleWrap : styles.aiBubbleWrap,
                    ]}
                  >
                    {!isUser && (
                      <Image
                        source={finnAvatarSource}
                        style={styles.aiBubbleAvatar}
                        resizeMode="cover"
                      />
                    )}

                    <View
                      style={[
                        styles.bubble,
                        isUser ? styles.userBubble : styles.aiBubble,
                      ]}
                    >
                      <FormattedMessage
                        text={msg.text}
                        isUser={isUser}
                        navigation={navigation}
                        onSpeak={() => handleSpeak(msg.id, msg.text)}
                        isSpeaking={speakingMsgId === msg.id}
                      />

                      {/* Transações criadas automaticamente */}
                      {((msg.transactions && msg.transactions.length > 0)
                        ? msg.transactions
                        : msg.transaction
                        ? [msg.transaction]
                        : []
                      ).map((tx, txIdx) => (
                        <View
                          key={tx.id || `tx-${txIdx}`}
                          style={styles.txCardInChat}
                        >
                          <View style={styles.txCardHeader}>
                            <Ionicons
                              name={
                                tx.type === 'income'
                                  ? 'arrow-up-circle'
                                  : 'arrow-down-circle'
                              }
                              size={16}
                              color={
                                tx.type === 'income'
                                  ? COLORS.income
                                  : COLORS.expense
                              }
                            />
                            <Text style={styles.txCardDesc}>{tx.description}</Text>
                            <Text
                              style={[
                                styles.txCardAmount,
                                {
                                  color:
                                    tx.type === 'income'
                                      ? COLORS.income
                                      : COLORS.expense,
                                },
                              ]}
                            >
                              R$ {(tx.amount || 0).toFixed(2).replace('.', ',')}
                            </Text>
                          </View>
                          <Text style={styles.txCardSub}>
                            {tx.cardName || tx.cardId || tx.paymentMethod === 'credit_card'
                              ? `💳 Fatura do cartão ${tx.cardName || 'de crédito'} atualizada • Extrato`
                              : `Lançado para ${tx.author || 'Você'} • Extrato atualizado`}
                          </Text>
                        </View>
                      ))}

                      {/* Botões de Ação Interativa (Crédito vs Débito ou Escolha de Cartão) */}
                      {!isUser && msg.interactiveAction?.type === 'ASK_PAYMENT_METHOD' && (
                        <View style={styles.interactiveActionContainer}>
                          <Text style={styles.interactiveActionTitle}>Selecione a forma de pagamento:</Text>
                          <View style={styles.interactiveActionRow}>
                            <TouchableOpacity
                              style={styles.interactiveActionBtnPrimary}
                              onPress={() => sendAiMessage('Foi no cartão de crédito')}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="card" size={14} color="#FFFFFF" />
                              <Text style={styles.interactiveActionBtnPrimaryText}>Cartão de Crédito</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.interactiveActionBtnSecondary}
                              onPress={() => sendAiMessage('Foi no débito')}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="cash-outline" size={14} color="#7C3AED" />
                              <Text style={styles.interactiveActionBtnSecondaryText}>Débito / Conta</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {!isUser && msg.interactiveAction?.type === 'ASK_CARD' && (
                        <View style={styles.interactiveActionContainer}>
                          <Text style={styles.interactiveActionTitle}>Escolha em qual cartão lançar:</Text>
                          <View style={styles.interactiveActionWrap}>
                            {(cards || []).length > 0 ? (
                              (cards || []).map((card) => (
                                <TouchableOpacity
                                  key={card.id}
                                  style={styles.interactiveCardPill}
                                  onPress={() => sendAiMessage(`Foi no cartão ${card.name || card.bank}`)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="card-outline" size={13} color="#7C3AED" />
                                  <Text style={styles.interactiveCardPillText}>{card.name || card.bank}</Text>
                                </TouchableOpacity>
                              ))
                            ) : (
                              <TouchableOpacity
                                style={styles.interactiveCardPill}
                                onPress={() => navigation.navigate('CardInvoices')}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="add-circle-outline" size={13} color="#7C3AED" />
                                <Text style={styles.interactiveCardPillText}>Cadastrar Cartão na aba Cartões</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.timeText,
                          isUser ? styles.userTimeText : styles.aiTimeText,
                        ]}
                      >
                        {msg.time}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {aiChat.length === 0 && (
                <View style={styles.emptyChatWrap}>
                  <Text style={styles.emptyChatText}>
                    Nenhuma mensagem ainda. Envie uma mensagem para começar!
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* INDICADOR DE CARREGAMENTO */}
          {analyzing && (
            <View style={styles.analyzingCard}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text style={styles.analyzingText}>{analyzingStatus}</Text>
            </View>
          )}
        </ScrollView>

        {/* ========================================================================= */}
        {/* BARRA INFERIOR DE ENTRADA FIEL AO PRINT 1                                 */}
        {/* ========================================================================= */}
        {isRecording ? (
          <View
            style={[
              styles.whatsappRecordBar,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <TouchableOpacity
              style={styles.cancelRecordBtn}
              onPress={cancelRecordingWhatsApp}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>

            <View style={styles.recordingTimerWrap}>
              <View style={styles.recRedDot} />
              <Text style={styles.recordingTimerText}>
                {formatTimer(recordingSeconds)}
              </Text>
              <Text style={styles.recordingHintText}>Gravando áudio...</Text>
            </View>

            <TouchableOpacity
              style={styles.sendRecordBtn}
              onPress={stopAndSendRecordingWhatsApp}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.inputBarOuter,
              { paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 14) },
            ]}
          >
            {/* PRÉVIA DO ARQUIVO ANEXADO ANTES DO ENVIO */}
            {attachedFile && (
              <View style={styles.attachedPreviewBox}>
                <View style={styles.attachedIconWrap}>
                  <Ionicons
                    name={
                      attachedFile.type === 'pdf'
                        ? 'document-text'
                        : attachedFile.type === 'csv'
                        ? 'stats-chart'
                        : 'image'
                    }
                    size={17}
                    color="#7C3AED"
                  />
                </View>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Text style={styles.attachedFileName} numberOfLines={1}>
                    {attachedFile.name}
                  </Text>
                  <Text style={styles.attachedFileSub}>
                    {attachedFile.type.toUpperCase()} • Digite uma mensagem antes de enviar (opcional)
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.attachedRemoveBtn}
                  onPress={() => setAttachedFile(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputBarPill}>
              {/* Botão de Clipe / Anexos */}
              <TouchableOpacity
                style={styles.clipBtn}
                activeOpacity={0.75}
                onPress={() => setAttachModalVisible(true)}
              >
                <Ionicons name="attach" size={24} color="#7C3AED" />
              </TouchableOpacity>

              {/* Campo de Texto */}
              <TextInput
                style={styles.textInput}
                placeholder="Digite uma mensagem..."
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSend()}
                returnKeyType="send"
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
              />

              {/* Botão de Gravação por Voz */}
              <TouchableOpacity
                style={styles.micBtn}
                activeOpacity={0.75}
                onPress={startRecordingWhatsApp}
              >
                <Ionicons name="mic-outline" size={22} color="#7C3AED" />
              </TouchableOpacity>

              {/* Botão Enviar com Aviãozinho Roxo */}
              <TouchableOpacity
                style={styles.sendBtn}
                activeOpacity={0.85}
                onPress={() => handleSend()}
              >
                <Ionicons name="send" size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ========================================================================= */}
      {/* MODAL DE ANEXOS                                                           */}
      {/* ========================================================================= */}
      <Modal visible={attachModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAttachModalVisible(false)}
        >
          <View style={styles.attachModalCard}>
            <Text style={styles.attachModalTitle}>Anexar ao FINN AI</Text>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={handleCameraReceipt}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="camera-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Fotografar Comprovante</Text>
                <Text style={styles.attachOptionSub}>Usar câmera para escanear recibo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={handlePickReceipt}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#F3EEFF' }]}>
                <Ionicons name="image-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Comprovante da Galeria</Text>
                <Text style={styles.attachOptionSub}>Selecionar print ou foto já salva</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={handlePickPdf}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="document-text-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Boleto ou Fatura (PDF)</Text>
                <Text style={styles.attachOptionSub}>Extrair dados completos do documento</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={handlePickCsv}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#F3EEFF' }]}>
                <Ionicons name="grid-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Planilha de Extrato (CSV)</Text>
                <Text style={styles.attachOptionSub}>Importar lista de lançamentos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachModalCancelBtn}
              onPress={() => setAttachModalVisible(false)}
            >
              <Text style={styles.attachModalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL DE MAIS OPÇÕES (MENU TRÊS PONTOS ⋮)                                */}
      {/* ========================================================================= */}
      <Modal visible={menuModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuModalVisible(false)}
        >
          <View style={styles.menuModalCard}>
            <Text style={styles.attachModalTitle}>Opções do Assistente</Text>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={() => {
                setShowHero(true);
                setMenuModalVisible(false);
              }}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="sparkles" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Tela Inicial da IA (Boneco)</Text>
                <Text style={styles.attachOptionSub}>Ver sugestões, atalhos e novo início</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={() => {
                setShowHero(false);
                setMenuModalVisible(false);
              }}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#F3EEFF' }]}>
                <Ionicons name="chatbubbles-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Histórico do Chat</Text>
                <Text style={styles.attachOptionSub}>Ver todas as mensagens trocadas</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={openGeminiLive}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="mic" size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Gemini Live (Voz Contínua)</Text>
                <Text style={styles.attachOptionSub}>Conversar ao vivo com o assistente</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOptionRow}
              onPress={() => {
                setMenuModalVisible(false);
                navigation?.navigate?.('Settings');
              }}
            >
              <View style={[styles.attachOptionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="settings-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionName}>Configurações de IA</Text>
                <Text style={styles.attachOptionSub}>Chave Gemini e seleção de modelo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachModalCancelBtn}
              onPress={() => setMenuModalVisible(false)}
            >
              <Text style={styles.attachModalCancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL GEMINI LIVE                                                         */}
      {/* ========================================================================= */}
      <Modal visible={liveModalVisible} transparent animationType="slide">
        <View style={styles.liveContainer}>
          <View style={styles.liveHeader}>
            <View style={styles.liveTitleRow}>
              <Ionicons name="radio" size={18} color="#38BDF8" />
              <Text style={styles.liveHeaderTitle}>GEMINI LIVE • FINN</Text>
            </View>
            <TouchableOpacity style={styles.liveCloseBtn} onPress={closeGeminiLive}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.liveBody}>
            <Animated.View
              style={[
                styles.liveOrbWrap,
                {
                  transform: [{ scale: orbScale }],
                  opacity: orbGlow,
                },
              ]}
            >
              <LinearGradient
                colors={['#7C3AED', '#38BDF8', '#6366F1']}
                style={styles.liveOrbGradient}
              />
            </Animated.View>

            <Text style={styles.liveStatusText}>
              {liveState === 'recording'
                ? 'FINN ouvindo...'
                : liveState === 'thinking'
                ? 'Processando...'
                : liveState === 'speaking'
                ? 'FINN falando...'
                : 'Toque para falar'}
            </Text>
            <Text style={styles.liveTimerText}>{formatTimer(liveDuration)}</Text>

            {liveUserTranscript ? (
              <View style={styles.liveTranscriptBox}>
                <Text style={styles.liveTranscriptLabel}>Você:</Text>
                <Text style={styles.liveTranscriptText}>{liveUserTranscript}</Text>
              </View>
            ) : null}

            {liveAiTranscript ? (
              <View style={[styles.liveTranscriptBox, styles.liveAiTranscriptBox]}>
                <Text style={styles.liveTranscriptLabel}>FINN:</Text>
                <Text style={styles.liveTranscriptText}>{liveAiTranscript}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.liveFooter}>
            <TouchableOpacity
              style={[
                styles.liveMicBtn,
                liveState === 'recording' && styles.liveMicBtnActive,
              ]}
              onPress={handleLiveToggleRecording}
              activeOpacity={0.8}
            >
              <Ionicons
                name={
                  liveState === 'recording'
                    ? 'stop'
                    : liveState === 'speaking'
                    ? 'volume-mute'
                    : 'mic'
                }
                size={34}
                color="#FFFFFF"
              />
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
    backgroundColor: '#F7F5FC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEAF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
    marginTop: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  robotImageWrapper: {
    width: '100%',
    height: 195,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginBottom: 6,
  },
  robotHeroImage: {
    width: '100%',
    height: '100%',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  dualAttachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    width: '100%',
    paddingVertical: 13,
    marginBottom: 16,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dualAttachmentHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dualAttachmentDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E5E7EB',
  },
  dualAttachmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
  },
  actionCardsList: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
    gap: 12,
  },
  actionCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#18181B',
  },
  quickHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  quickHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  quickTrocarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickTrocarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  quickPill: {
    flexBasis: '48.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 7,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  quickPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#18181B',
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    width: '100%',
  },
  viewHistoryText: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '700',
  },
  backToHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3EEFF',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  backToHeroText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyChatWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyChatText: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
  },
  chatMessagesContainer: {
    marginTop: 6,
    marginBottom: 10,
  },
  messageBubbleWrap: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  userBubbleWrap: {
    justifyContent: 'flex-end',
  },
  aiBubbleWrap: {
    justifyContent: 'flex-start',
  },
  aiBubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEAF8',
    borderBottomLeftRadius: 4,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  aiBubbleText: {
    color: '#18181B',
  },
  formattedWrap: {
    gap: 4,
  },
  boldAiText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  bulletText: {
    paddingLeft: 4,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  aiTimeText: {
    color: '#9CA3AF',
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  listenBtnActive: {
    backgroundColor: '#E0F2FE',
  },
  listenBtnText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '700',
  },
  listenBtnTextActive: {
    color: '#0284C7',
  },
  keyWarningActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  keyWarningActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  txCardInChat: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  txCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txCardDesc: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
  },
  txCardAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  txCardSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  interactiveActionContainer: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  interactiveActionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
    marginBottom: 8,
  },
  interactiveActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  interactiveActionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interactiveActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  interactiveActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  interactiveActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  interactiveActionBtnSecondaryText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
  },
  interactiveCardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C4B5FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interactiveCardPillText: {
    color: '#5B21B6',
    fontSize: 12,
    fontWeight: '700',
  },
  analyzingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEAF8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  analyzingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  inputBarOuter: {
    paddingHorizontal: 16,
    backgroundColor: '#F7F5FC',
  },
  attachedPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  attachedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedFileName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#581C87',
  },
  attachedFileSub: {
    fontSize: 10,
    color: '#7E22CE',
    marginTop: 1,
  },
  attachedRemoveBtn: {
    padding: 3,
  },
  inputBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    gap: 6,
  },
  clipBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#18181B',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  micBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappRecordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    gap: 12,
  },
  cancelRecordBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingTimerWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recRedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimerText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
  },
  recordingHintText: {
    fontSize: 12,
    color: '#6B7280',
  },
  sendRecordBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  attachModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 10,
  },
  menuModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 10,
  },
  attachModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 6,
  },
  attachOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  attachOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181B',
  },
  attachOptionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  attachModalCancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  attachModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  liveContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveHeaderTitle: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBody: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveOrbWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  liveOrbGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  liveStatusText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  liveTimerText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
  },
  liveTranscriptBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  liveAiTranscriptBox: {
    borderColor: '#38BDF8',
  },
  liveTranscriptLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    marginBottom: 4,
  },
  liveTranscriptText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  liveFooter: {
    alignItems: 'center',
  },
  liveMicBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  liveMicBtnActive: {
    backgroundColor: '#EF4444',
  },
});
