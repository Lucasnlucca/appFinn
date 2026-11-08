import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
} from 'react-native';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

const CustomAlertContext = createContext({
  showAlert: () => {},
  hideAlert: () => {},
});

// Referência global para interceptar Alert.alert de qualquer ponto do app
let globalAlertHandler = null;

// Hook no Alert.alert da react-native
const originalNativeAlert = Alert.alert;
Alert.alert = (title, message, buttons, options) => {
  if (globalAlertHandler) {
    globalAlertHandler({ title, message, buttons, options });
  } else {
    originalNativeAlert(title, message, buttons, options);
  }
};

export function CustomAlertProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    buttons: [],
    type: 'default',
    code: null,
    groupName: null,
    expiresInMinutes: 30,
  });

  const handleCopyCode = async (codeToCopy) => {
    if (!codeToCopy) return;
    try {
      await Clipboard.setStringAsync(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Erro ao copiar código:', e);
    }
  };

  const showAlert = useCallback(({ title = '', message = '', buttons = [], options = {}, type, code }) => {
    setCopied(false);

    let detectedType = type || 'default';
    let detectedCode = code || null;
    let cleanMessage = typeof message === 'string' ? message : '';
    let extractedGroupName = null;

    // 1. Extração de código de convite inteligente
    if (!detectedCode && typeof cleanMessage === 'string') {
      const codeMatch = cleanMessage.match(/(?:código(?:\s+de\s+convite|\s+de\s+acesso)?|novo\s+código):\s*([A-Z0-9]{4,10})/i);
      if (codeMatch && codeMatch[1]) {
        detectedCode = codeMatch[1].trim().toUpperCase();
        detectedType = 'code';
      }
    }

    // 2. Extração de nome de grupo se houver
    if (typeof cleanMessage === 'string') {
      const groupMatch = cleanMessage.match(/(?:nome|grupo):\s*([^\n\r]+)/i);
      if (groupMatch && groupMatch[1]) {
        extractedGroupName = groupMatch[1].trim();
      }
    }

    // 3. Limpeza do texto para não duplicar o código que já fica no bloco destacado
    if (detectedCode && typeof cleanMessage === 'string') {
      cleanMessage = cleanMessage
        .replace(/(?:código(?:\s+de\s+convite|\s+de\s+acesso)?|novo\s+código):\s*[A-Z0-9]{4,10}/gi, '')
        .replace(/(?:nome|grupo):\s*[^\n\r]+/gi, '')
        .trim();
    }

    // 4. Detecção de tipo automático para ícones temáticos caso não seja código
    if (detectedType === 'default') {
      const lowerTitle = (title || '').toLowerCase();
      const lowerMsg = (cleanMessage || '').toLowerCase();

      if (
        lowerTitle.includes('sucesso') ||
        lowerTitle.includes('parabéns') ||
        lowerTitle.includes('🎉') ||
        lowerMsg.includes('sucesso') ||
        lowerMsg.includes('salvo')
      ) {
        detectedType = 'success';
      } else if (
        lowerTitle.includes('erro') ||
        lowerTitle.includes('falha') ||
        lowerTitle.includes('expirou') ||
        lowerMsg.includes('expirou') ||
        lowerMsg.includes('erro')
      ) {
        detectedType = 'error';
      } else if (
        lowerTitle.includes('atenção') ||
        lowerTitle.includes('aviso') ||
        lowerTitle.includes('importante') ||
        lowerTitle.includes('⚠️')
      ) {
        detectedType = 'warning';
      } else if (
        lowerTitle.includes('certeza') ||
        lowerTitle.includes('confirmar') ||
        lowerTitle.includes('excluir') ||
        lowerTitle.includes('sair')
      ) {
        detectedType = 'confirm';
      }
    }

    // Botões padronizados
    const normalizedButtons = Array.isArray(buttons) && buttons.length > 0
      ? buttons
      : [{ text: 'Entendido', style: 'default' }];

    setAlertConfig({
      title,
      message: cleanMessage,
      buttons: normalizedButtons,
      options,
      type: detectedType,
      code: detectedCode,
      groupName: extractedGroupName,
      expiresInMinutes: 30,
    });

    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  // Registra no ponteiro global
  useEffect(() => {
    globalAlertHandler = showAlert;
    return () => {
      globalAlertHandler = null;
    };
  }, [showAlert]);

  // Renderização do ícone no topo do popup
  const renderIconBadge = () => {
    const { type } = alertConfig;
    if (type === 'code') {
      return (
        <LinearGradient
          colors={['#8B5CF6', '#6D28D9']}
          style={styles.iconCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="key" size={28} color="#FFFFFF" />
        </LinearGradient>
      );
    }
    if (type === 'success') {
      return (
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.iconCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="checkmark-done" size={32} color="#FFFFFF" />
        </LinearGradient>
      );
    }
    if (type === 'error') {
      return (
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          style={styles.iconCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="alert-circle" size={32} color="#FFFFFF" />
        </LinearGradient>
      );
    }
    if (type === 'warning') {
      return (
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          style={styles.iconCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="warning" size={28} color="#FFFFFF" />
        </LinearGradient>
      );
    }
    if (type === 'confirm') {
      return (
        <LinearGradient
          colors={['#8B5CF6', '#6D28D9']}
          style={styles.iconCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="help-circle" size={32} color="#FFFFFF" />
        </LinearGradient>
      );
    }
    // Default: mascote ou faíscas FINN
    return (
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={styles.iconCircle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="sparkles" size={28} color="#FFFFFF" />
      </LinearGradient>
    );
  };

  const handleButtonPress = (btn) => {
    hideAlert();
    if (typeof btn.onPress === 'function') {
      btn.onPress();
    }
  };

  return (
    <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.alertCard}>
            {/* Decoração superior com ondas e brilho lilás */}
            <View style={styles.cardHeaderGlowBlob} pointerEvents="none" />

            {/* Ícone estilizado em destaque */}
            <View style={styles.iconWrapper}>
              {renderIconBadge()}
            </View>

            {/* Título do alerta */}
            {Boolean(alertConfig.title) && (
              <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            )}

            {/* Se houver nome de grupo detectado */}
            {Boolean(alertConfig.groupName) && (
              <View style={styles.groupBadge}>
                <Ionicons name="people" size={14} color="#7C3AED" />
                <Text style={styles.groupBadgeText}>Grupo: {alertConfig.groupName}</Text>
              </View>
            )}

            {/* BLOCO ESPECIAL DESTACADO DE CÓDIGO (Quando for código) */}
            {Boolean(alertConfig.code) && (
              <View style={styles.codeBoxContainer}>
                <View style={styles.codeBoxHeaderRow}>
                  <View style={styles.codePillBadge}>
                    <Ionicons name="key" size={12} color="#7C3AED" />
                    <Text style={styles.codePillBadgeText}>CÓDIGO DE CONVITE</Text>
                  </View>
                  <View style={styles.expiresBadge}>
                    <Ionicons name="time-outline" size={12} color="#059669" />
                    <Text style={styles.expiresBadgeText}>30 min</Text>
                  </View>
                </View>

                {/* Código em letras grandes e espaçadas */}
                <TouchableOpacity
                  style={styles.codeTouchArea}
                  onPress={() => handleCopyCode(alertConfig.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.codeLargeText}>
                    {alertConfig.code.split('').join(' ')}
                  </Text>
                </TouchableOpacity>

                {/* Botão interativo de copiar com feedback */}
                <TouchableOpacity
                  style={[styles.copyButton, copied && styles.copyButtonActive]}
                  onPress={() => handleCopyCode(alertConfig.code)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    size={16}
                    color={copied ? '#FFFFFF' : '#7C3AED'}
                  />
                  <Text style={[styles.copyButtonText, copied && styles.copyButtonTextActive]}>
                    {copied ? 'Código Copiado!' : 'Tocar para copiar'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Mensagem textual limpa */}
            {Boolean(alertConfig.message) && (
              <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            )}

            {/* Botões de Ação Personalizados */}
            <View style={styles.buttonsContainer}>
              {alertConfig.buttons.map((btn, idx) => {
                const isCancel =
                  btn.style === 'cancel' ||
                  (btn.text && ['cancelar', 'voltar', 'fechar'].includes(btn.text.toLowerCase()));

                if (isCancel) {
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.cancelButton}
                      onPress={() => handleButtonPress(btn)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.cancelButtonText}>{btn.text || 'Cancelar'}</Text>
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.primaryButtonWrapper}
                    onPress={() => handleButtonPress(btn)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#6D28D9']}
                      style={styles.primaryButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {btn.text && btn.text.toLowerCase().includes('compartilhar') && (
                        <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      )}
                      <Text style={styles.primaryButtonText}>{btn.text || 'OK'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

export function useCustomAlert() {
  return useContext(CustomAlertContext);
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 8, 30, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  alertCard: {
    width: '100%',
    maxWidth: Math.min(width - 36, 380),
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 16,
  },
  cardHeaderGlowBlob: {
    position: 'absolute',
    top: -50,
    width: 220,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FAF5FF',
  },
  iconWrapper: {
    marginBottom: 6,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FAF5FF',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#18181B',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginTop: 8,
    marginBottom: 6,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  groupBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  alertMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 21,
    marginVertical: 4,
    paddingHorizontal: 6,
  },
  // BLOCO DE CÓDIGO
  codeBoxContainer: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D8B4FE',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginVertical: 12,
    alignItems: 'center',
  },
  codeBoxHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  codePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  codePillBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  expiresBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  expiresBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  codeTouchArea: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  codeLargeText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#6D28D9',
    letterSpacing: 4,
    textAlign: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 8,
  },
  copyButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  copyButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  copyButtonTextActive: {
    color: '#FFFFFF',
  },
  // BOTÕES
  buttonsContainer: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  primaryButtonWrapper: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F0FD',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
});
