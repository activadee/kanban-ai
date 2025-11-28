import {TicketNumberingForm} from '@/components/projects/settings/TicketNumberingForm'

type TicketSettingsSectionProps = {
    ticketPrefix: string;
    nextTicketNumber: number;
    onPrefixChange: (value: string) => void;
}

export function TicketSettingsSection({
                                          ticketPrefix,
                                          nextTicketNumber,
                                          onPrefixChange,
                                      }: TicketSettingsSectionProps) {
    return (
        <TicketNumberingForm
            ticketPrefix={ticketPrefix}
            nextTicketNumber={nextTicketNumber}
            onPrefixChange={onPrefixChange}
        />
    )
}

