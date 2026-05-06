import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type AppointmentPresentation = {
  appointmentId: string;
  dateLine: string;
  timeLine: string;
  statusLabel: string;
  specialistName: string;
  serviceName: string;
  address: string;
};

type NextAppointmentCardProps = {
  appointment: AppointmentPresentation | null;
  cancelSubmitting: boolean;
  onCancelPress: () => void;
  onBookPress: () => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'С';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function NextAppointmentCard(props: NextAppointmentCardProps) {
  const { appointment, cancelSubmitting, onCancelPress, onBookPress } = props;

  if (appointment == null) {
    return (
      <View style={styles.emptyAppointment}>
        <Text style={styles.emptyAppointmentTitle}>Нет предстоящих записей</Text>
        <Text style={styles.emptyAppointmentSub}>
          Выберите студию, затем специалиста, услугу и удобное время — или начните с каталога услуг.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Записаться"
          onPress={onBookPress}
          style={({ pressed }) => [styles.bookAppointmentBtn, pressed && styles.pressed]}
        >
          <Text style={styles.bookAppointmentBtnText}>Записаться</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentAccent} />
      <View style={styles.appointmentTop}>
        <Text style={styles.titleText}>Запись запланирована</Text>
        <View style={styles.whenDateRow}>
          <Text style={styles.dateText}>{appointment.dateLine}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{appointment.statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.timeText}>{appointment.timeLine}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.appointmentBottom}>
        <View style={styles.specAvatar}>
          <Text style={styles.specAvatarText}>{initialsFromName(appointment.specialistName)}</Text>
        </View>
        <View style={styles.specInfo}>
          <Text style={styles.specialistText}>{appointment.specialistName}</Text>
          <Text style={styles.serviceText}>{appointment.serviceName}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.addressRow}>
        <FontAwesome name="map-marker" size={14} color="rgba(11,27,20,0.55)" />
        <Text style={styles.addressText}>{appointment.address}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Отменить запись"
          disabled={cancelSubmitting}
          onPress={onCancelPress}
          style={({ pressed }) => [
            styles.cancelBtn,
            pressed && !cancelSubmitting && styles.pressed,
            cancelSubmitting && styles.cancelBtnDisabled,
          ]}
        >
          <Text style={styles.cancelText}>Отменить</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appointmentCard: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    position: 'relative',
  },
  appointmentAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#75DAA8',
    opacity: 0.35,
  },
  appointmentTop: {
    gap: 6,
    backgroundColor: 'transparent',
  },
  titleText: {
    fontSize: 12,
    color: '#1A1A2E',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.9,
  },
  whenDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#0F5238',
    fontWeight: '700',
  },
  timeText: {
    fontSize: 24,
    color: '#1A1A2E',
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(243,244,245,1)',
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(11,27,20,0.65)',
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(149,163,160,0.25)',
  },
  appointmentBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  specAvatar: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.10)',
  },
  specAvatarText: {
    fontSize: 12,
    color: '#2D6A4F',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  specInfo: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  specialistText: {
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '600',
  },
  serviceText: {
    fontSize: 13,
    color: 'rgba(11,27,20,0.55)',
    fontWeight: '400',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#404943',
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnDisabled: {
    opacity: 0.55,
  },
  cancelText: {
    fontSize: 14,
    color: '#BA1A1A',
    fontWeight: '500',
  },
  emptyAppointment: {
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  emptyAppointmentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  emptyAppointmentSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: 'rgba(11,27,20,0.55)',
    fontFamily: 'Inter_500Medium',
  },
  bookAppointmentBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookAppointmentBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: {
    opacity: 0.85,
  },
});
