import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
// import { config } from "@/config/config"
import type { PerplexityModel } from '@/lib/perplexityClient';

type Props = {
  value?: PerplexityModel;
  onChange: (value: PerplexityModel) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
};

/**
 * Available model options with descriptions
 * Uses config to determine recommended models
 */
const getModelOptions = () => {
  // Base descriptions
  const descriptions: Record<string, string> = {
    'sonar': 'Sonar (Recommended - Fast & Reliable)',
    'sonar-pro': 'Sonar Pro (Enhanced)',
    'sonar-deep-research': 'Sonar Research (Most Comprehensive, Expensive)'
  };
  
  // Return model options
  return [
    { value: 'sonar', label: descriptions['sonar'] },
    { value: 'sonar-pro', label: descriptions['sonar-pro'] },
    { 
      value: 'sonar-deep-research', 
      label: descriptions['sonar-deep-research']
    }
  ];
};
 

export default function ModelSelector({ value, onChange, disabled, label = "Model", description }: Props) {
  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor="model">{label}</Label>
      <Select
        value={value}
        onValueChange={onChange}
        defaultValue="sonar"
        disabled={disabled}
      >
        <SelectTrigger id="model" className="w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {/* Dynamically render models from config and available options */}
          {getModelOptions().map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              title={`Select ${option.value} model`}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
        {description && (
          <div className="mt-1 text-sm text-muted-foreground">
            {description}
          </div>
        )}
      </Select>
    </div>
  );
}