import type { StylesConfig } from 'react-select'

type SelectOption = {
    value: string
    label: string
}

/** Shared emerald multi-select styles for react-select / CreatableSelect. */
export const multiSelectStyles: StylesConfig<SelectOption, true> = {
    control: (base, state) => ({
        ...base,
        backgroundColor: '#ffffff',
        borderColor: state.isFocused ? '#10b981' : '#d4d4d4',
        boxShadow: state.isFocused ? '0 0 0 2px rgb(16 185 129 / 0.2)' : 'none',
        minHeight: '42px',
        fontSize: '14px',
        borderRadius: '8px',
        ':hover': {
            borderColor: state.isFocused ? '#10b981' : '#a3a3a3',
        },
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        fontSize: '14px',
        borderRadius: '8px',
        zIndex: 20,
        boxShadow:
            '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
            ? '#ecfdf5'
            : state.isFocused
              ? '#f5f5f5'
              : '#ffffff',
        color: state.isSelected ? '#065f46' : '#171717',
        fontSize: '14px',
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: '#ecfdf5',
        borderRadius: '6px',
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#065f46',
        fontSize: '12px',
        fontWeight: 500,
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#047857',
        ':hover': {
            backgroundColor: '#a7f3d0',
            color: '#065f46',
        },
    }),
    placeholder: (base) => ({
        ...base,
        color: '#737373',
        fontSize: '14px',
    }),
    input: (base) => ({
        ...base,
        color: '#171717',
        fontSize: '14px',
    }),
    dropdownIndicator: (base) => ({
        ...base,
        color: '#737373',
    }),
    indicatorSeparator: (base) => ({
        ...base,
        backgroundColor: '#e5e5e5',
    }),
}
