import { ConfigValueType } from './config.model';

export interface ConfigDTO {
  id: string;
  key: string;
  value: string;
  valueType: ConfigValueType;
  category: string;
  displayName: string;
  description: string;
  updatedBy?: string;
  updatedAt: Date;
}

export interface ConfigsByCategoryDTO {
  category: string;
  configs: ConfigDTO[];
}

export interface UpdateConfigInput {
  value: string;
}

export interface SeedConfigItem {
  key: string;
  value: string;
  valueType: ConfigValueType;
  category: string;
  displayName: string;
  description: string;
}
