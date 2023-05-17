interface User {
    id: string;
    name: string;
    email: string;
    image: string;
    picture: string;
    idp: string;
    iat: number;
    mfa: boolean;
    groups: string[];
    intercom_hash: string;
}

interface SessionData {
    user: User;
    expires: string;
    accessToken: string;
    authProvider: string;
}

interface ModelQualitativeProperties {
    reasoning?: [number, number];
    speed?: [number, number];
    conciseness?: [number, number];
}

interface Model {
    slug: string;
    max_tokens: number;
    title: string;
    description: string;
    tags: string[];
    qualitative_properties: ModelQualitativeProperties;
    enabled_tools?: string[];
}

interface Category {
    category: string;
    human_category_name: string;
    subscription_level: string;
    default_model: string;
    browsing_model: string | null;
    code_interpreter_model: string | null;
    plugins_model: string | null;
}

interface AvailableModelsData {
    models: Model[];
    categories: Category[];
}

interface AccountPlan {
  is_paid_subscription_active: boolean;
  subscription_plan: string;
  account_user_role: string;
  was_paid_customer: boolean;
  has_customer_object: boolean;
  subscription_expires_at_timestamp: number;
}

interface UserAccountData {
  account_plan: AccountPlan;
  user_country: string;
  features: string[];
}

