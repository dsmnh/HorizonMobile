import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeRoute, StorageRoute, ChatRoute, ToolsRoute } from './routes';
import { useTheme } from './theme';
import type { MainTabParamList } from './nav';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Storage: 'server-outline',
  Chat: 'chatbubbles-outline',
  Tools: 'apps-outline',
};

export function MainTabs(): JSX.Element {
  const { colors } = useTheme();
  return (
    <Tabs.Navigator backBehavior="history" screenOptions={({ route }) => ({
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textDim,
      tabBarStyle: { minHeight: 62, backgroundColor: colors.surface, borderTopColor: colors.border },
      tabBarItemStyle: { minHeight: 48, paddingVertical: 5 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color }) => <Ionicons name={icons[route.name]} color={color} size={22} />,
    })}>
      <Tabs.Screen name="Home" component={HomeRoute} options={{ title: '首页' }} />
      <Tabs.Screen name="Storage" component={StorageRoute} options={{ title: '存储' }} />
      <Tabs.Screen name="Chat" component={ChatRoute} options={{ title: '聊天' }} />
      <Tabs.Screen name="Tools" component={ToolsRoute} options={{ title: '工具' }} />
    </Tabs.Navigator>
  );
}
