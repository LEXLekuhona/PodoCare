import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { BookingTabIcon } from '@/shared/ui/icons/tabs/BookingTabIcon';
import { EducationTabIcon } from '@/shared/ui/icons/tabs/EducationTabIcon';
import { HomeTabIcon } from '@/shared/ui/icons/tabs/HomeTabIcon';
import { ProductsTabIcon } from '@/shared/ui/icons/tabs/ProductsTabIcon';
import { ProfileTabIcon } from '@/shared/ui/icons/tabs/ProfileTabIcon';

function TabBarIconSlot(props: { children: React.ReactNode }) {
  return <View style={{ marginBottom: -3 }}>{props.children}</View>;
}

const TAB_ACTIVE = '#2D6A4F';
const TAB_INACTIVE = '#707973';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color }) => (
            <TabBarIconSlot>
              <HomeTabIcon color={color} size={26} />
            </TabBarIconSlot>
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Товары',
          tabBarIcon: ({ color }) => (
            <TabBarIconSlot>
              <ProductsTabIcon color={color} size={26} />
            </TabBarIconSlot>
          ),
        }}
      />
      <Tabs.Screen
        name="education"
        options={{
          title: 'Обучение',
          tabBarIcon: ({ color }) => (
            <TabBarIconSlot>
              <EducationTabIcon color={color} size={26} />
            </TabBarIconSlot>
          ),
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          title: 'Запись',
          tabBarIcon: ({ color }) => (
            <TabBarIconSlot>
              <BookingTabIcon color={color} size={26} />
            </TabBarIconSlot>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color }) => (
            <TabBarIconSlot>
              <ProfileTabIcon color={color} size={26} />
            </TabBarIconSlot>
          ),
        }}
      />
    </Tabs>
  );
}

