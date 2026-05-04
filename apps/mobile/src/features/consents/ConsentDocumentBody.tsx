import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export function ConsentDocumentBody({ paragraphs }: { paragraphs: string[] }) {
  return (
    <View style={styles.doc} lightColor="transparent" darkColor="transparent">
      {paragraphs.map((p, idx) => {
        const isTitle = /^\d+\./.test(p) || p === '4. Срок действия согласия';
        const isHeading = /^\d+\./.test(p);
        const isList = p.startsWith('• ');
        return (
          <Text
            key={idx}
            style={[
              styles.docText,
              p === '' && styles.docSpacer,
              isHeading && styles.docHeading,
              isTitle && styles.docHeading,
              isList && styles.docList,
            ]}
            lightColor="rgba(26,26,46,0.86)"
            darkColor="rgba(255,255,255,0.86)"
          >
            {p === '' ? ' ' : p}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  doc: {
    gap: 8,
  },
  docText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  docHeading: {
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginTop: 6,
  },
  docList: {
    paddingLeft: 8,
  },
  docSpacer: {
    height: 6,
  },
});
