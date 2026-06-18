import { Badge } from "@mantine/core";
import {
  getOdexStatusColor,
  getOdexStatusLabel,
} from "../odexConstants";

type Props = {
  status: string;
};

export default function OdexStatusBadge({ status }: Props) {
  const color = getOdexStatusColor(status);
  return (
    <Badge color={color} variant="light" radius="sm">
      {getOdexStatusLabel(status)}
    </Badge>
  );
}
