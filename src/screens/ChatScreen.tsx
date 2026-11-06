import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HELP_TEXT, handleChatMessage } from '../lib/chatBot';
import { addChatMessage, type ChatMessage, type ExpenseSource, listChatMessages } from '../lib/db';
import { formatTime } from '../lib/format';
import { useSettings } from '../lib/hooks';
import { useTheme } from '../theme';

type Props = {
  /** Text shared into the app from another app (WhatsApp, SMS, notes…). */
  incoming: string | null;
  onIncomingHandled: () => void;
};

const SUGGESTIONS = ['today', 'month', 'recent', 'undo', 'help'];

export function ChatScreen({ incoming, onIncomingHandled }: Props) {
  const t = useTheme();
  const { currency } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    listChatMessages().then(async (m) => {
      if (m.length === 0) m = [await addChatMessage('bot', `👋 Hi! ${HELP_TEXT}`)];
      setMessages(m);
    });
  }, []);

  const send = async (raw: string, source: ExpenseSource = 'chat') => {
    const body = raw.trim();
    if (!body || busy || !currency) return;
    setBusy(true);
    setText('');
    try {
      const mine = await addChatMessage('me', body);
      setMessages((m) => [...m, mine]);
      const reply = await addChatMessage('bot', await handleChatMessage(body, currency, source));
      setMessages((m) => [...m, reply]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (incoming && currency) {
      send(incoming, 'share');
      onIncomingHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, currency]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const me = item.role === 'me';
          return (
            <View
              style={[
                styles.bubble,
                me
                  ? { alignSelf: 'flex-end', backgroundColor: t.bubbleMe, borderBottomRightRadius: 4 }
                  : { alignSelf: 'flex-start', backgroundColor: t.bubbleBot, borderBottomLeftRadius: 4, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Text style={{ color: me ? t.bubbleMeText : t.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
              <Text style={{ color: me ? t.bubbleMeText : t.muted, opacity: 0.7, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 }}>
                {formatTime(item.createdAt)}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s} onPress={() => send(s)} style={[styles.suggestion, { borderColor: t.border, backgroundColor: t.card }]}>
            <Text style={{ color: t.primary, fontWeight: '600' }}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.inputRow, { borderTopColor: t.border, backgroundColor: t.card }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="e.g. lunch 1200"
          placeholderTextColor={t.muted}
          multiline
          style={[styles.input, { color: t.text, backgroundColor: t.bg }]}
          onSubmitEditing={() => send(text)}
          submitBehavior="submit"
          returnKeyType="send"
        />
        <Pressable onPress={() => send(text)} disabled={busy || !text.trim()} style={[styles.send, { backgroundColor: text.trim() ? t.primary : t.border }]}>
          <Text style={{ color: t.primaryText, fontSize: 18, fontWeight: '700' }}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  suggestions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8, flexWrap: 'wrap' },
  suggestion: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
