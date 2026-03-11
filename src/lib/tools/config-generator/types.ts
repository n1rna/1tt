export type ConfigFormat = "json" | "yaml" | "toml" | "ini" | "nginx" | "text" | "env" | "kdl" | "conf";

export interface AppDefinition {
  id: string;
  name: string;
  configFileName: string;
  version: string;
  format: ConfigFormat;
  icon: string; // lucide icon name
  description: string;
  docsUrl: string;
  sections: ConfigSection[];
  serialize: (values: Record<string, unknown>, enabledFields: Set<string>) => string;
  deserialize: (raw: string) => { values: Record<string, unknown>; enabledFields: string[] };
  validate?: (raw: string) => { valid: boolean; error?: string };
}

export interface ConfigSection {
  id: string;
  label: string;
  description?: string;
  fields: ConfigField[];
}

export type ConfigField =
  | BooleanField
  | StringField
  | NumberField
  | SelectField
  | MultiSelectField
  | StringArrayField;

interface BaseField {
  id: string; // dot-path key, e.g. "compilerOptions.strict"
  label: string;
  description?: string;
  enabledByDefault?: boolean;
}

export interface BooleanField extends BaseField {
  type: "boolean";
  defaultValue: boolean;
}

export interface StringField extends BaseField {
  type: "string";
  defaultValue: string;
  placeholder?: string;
}

export interface NumberField extends BaseField {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
}

export interface SelectField extends BaseField {
  type: "select";
  options: { value: string; label: string }[];
  defaultValue: string;
}

export interface MultiSelectField extends BaseField {
  type: "multi-select";
  options: { value: string; label: string }[];
  defaultValue: string[];
}

export interface StringArrayField extends BaseField {
  type: "string-array";
  defaultValue: string[];
  placeholder?: string;
}
