export type Id = string;
export type IsoDateString = string;

export interface ModifierBreakdown {
  source: string;
  value: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
