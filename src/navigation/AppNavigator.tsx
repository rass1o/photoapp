import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { colors, fonts } from '../theme';
import { useNotifications } from '../context/NotificationsContext';

import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';
import RankingsScreen from '../screens/RankingsScreen';
import ShopScreen from '../screens/ShopScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SubmissionDetailScreen from '../screens/SubmissionDetailScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import OctopusScreen from '../screens/OctopusScreen';
import GalleryScreen from '../screens/GalleryScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Home: undefined;
  Submit: undefined;
  Rankings: undefined;
  Shop: undefined;
  Profile: undefined;
};

// Screens that can be pushed on top of the tabs from anywhere in the app
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  SubmissionDetail: { submissionId: string };
  UserProfile: { userId: string };
  Octopus: undefined;
  Gallery: { userId: string; username: string };
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

type IoniconName = keyof typeof Ionicons.glyphMap;

function MainTabs() {
  const { unread } = useNotifications();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.reef,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.shell, borderTopColor: colors.sandBorder },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<keyof RootTabParamList, IoniconName> = {
            Home: 'home-outline',
            Submit: 'camera-outline',
            Rankings: 'trophy-outline',
            Shop: 'storefront-outline',
            Profile: 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.coral, fontFamily: fonts.semibold, fontSize: 10 },
        }}
      />
      <Tab.Screen name="Submit" component={CameraScreen} />
      <Tab.Screen name="Rankings" component={RankingsScreen} />
      <Tab.Screen name="Shop" component={ShopScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="SubmissionDetail"
        component={SubmissionDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Octopus"
        component={OctopusScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}