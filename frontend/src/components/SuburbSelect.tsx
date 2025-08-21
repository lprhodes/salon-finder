import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const SUBURBS = [
  'Surry Hills',
  'Paddington',
  'Sydney CBD',
  'Bondi Junction',
  'Newtown',
  'Cronulla',
  'Mosman',
  'Manly',
  'Chatswood',
  'Parramatta',
  'Blacktown'
];

export default function SuburbSelect({ value, onChange, disabled }: Props) {
  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor="suburb">Suburb</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger id="suburb" className="w-full">
          <SelectValue placeholder="Please select a suburb" />
        </SelectTrigger>
        <SelectContent>
          {SUBURBS.map(suburb => (
            <SelectItem key={suburb} value={suburb}>
              {suburb}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}